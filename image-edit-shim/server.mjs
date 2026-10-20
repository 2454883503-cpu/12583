/**
 * Local shim that adds image-editing support to `openai-api-server-via-codex`.
 *
 * The bridge (127.0.0.1:18080) implements /v1/images/generations but not
 * /v1/images/edits. It *does* support reference-image input plus a hosted
 * image_generation tool through /v1/responses, which is exactly the capability
 * an edit needs. This process exposes the standard OpenAI surface the
 * dsh-image-gen plugin expects and translates edits onto that Responses path.
 *
 *   POST /v1/images/generations  -> transparent passthrough to the bridge
 *   POST /v1/images/edits        -> Responses + image_generation tool
 *   GET  /healthz                -> liveness + upstream reachability
 *   GET  /v1/models              -> passthrough
 *
 * Accepts both the multipart form format and the JSON `{images:[{image_url}]}`
 * shape, so any `openaiCompatEditFormat` the plugin offers works.
 */

import http from 'node:http'

const PORT = Number(process.env.SHIM_PORT ?? 18081)
const UPSTREAM = (process.env.SHIM_UPSTREAM ?? 'http://127.0.0.1:18080').replace(/\/+$/, '')
const EDIT_MODEL = process.env.SHIM_EDIT_MODEL ?? 'gpt-6-luna'
const SHIM_BACKGROUND = process.env.SHIM_BACKGROUND ?? 'transparent'
const SHIM_FORMAT = process.env.SHIM_FORMAT ?? 'png'
const MAX_BODY = 64 * 1024 * 1024
const MAX_IMAGES = 8

const log = (...args) => console.log(new Date().toISOString(), ...args)

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0
    req.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > MAX_BODY) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function boundaryOf(contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? '')
  return (match?.[1] ?? match?.[2] ?? '').trim()
}

/** Minimal multipart/form-data parser: enough for image uploads. */
function parseMultipart(body, boundary) {
  const delimiter = Buffer.from(`--${boundary}`)
  const parts = []
  let cursor = body.indexOf(delimiter)
  while (cursor !== -1) {
    let start = cursor + delimiter.length
    if (body.subarray(start, start + 2).toString() === '--') break
    if (body.subarray(start, start + 2).toString() === '\r\n') start += 2
    const next = body.indexOf(delimiter, start)
    if (next === -1) break
    let end = next
    if (body.subarray(end - 2, end).toString() === '\r\n') end -= 2
    const chunk = body.subarray(start, end)
    const headerEnd = chunk.indexOf('\r\n\r\n')
    if (headerEnd !== -1) {
      const headerText = chunk.subarray(0, headerEnd).toString('latin1')
      const data = chunk.subarray(headerEnd + 4)
      const name = /name="([^"]*)"/i.exec(headerText)?.[1] ?? ''
      const filename = /filename="([^"]*)"/i.exec(headerText)?.[1]
      const contentType = /content-type:\s*([^\r\n]+)/i.exec(headerText)?.[1]?.trim()
      parts.push({ name, filename, contentType, data })
    }
    cursor = next
  }
  return parts
}

function mediaTypeOf(part) {
  const declared = part.contentType?.split(';')[0]?.trim().toLowerCase()
  if (declared?.startsWith('image/')) return declared
  const head = part.data.subarray(0, 12)
  if (head[0] === 0x89 && head[1] === 0x50) return 'image/png'
  if (head[0] === 0xff && head[1] === 0xd8) return 'image/jpeg'
  if (head.subarray(0, 4).toString('latin1') === 'RIFF') return 'image/webp'
  if (head.subarray(0, 3).toString('latin1') === 'GIF') return 'image/gif'
  return 'image/png'
}

function toDataUrl(part) {
  return `data:${mediaTypeOf(part)};base64,${part.data.toString('base64')}`
}

/** Decode a `data:image/...;base64,` URL (or a bare base64 payload). */
function dataUrlImage(value) {
  if (typeof value !== 'string' || value.length === 0) return undefined
  const comma = value.startsWith('data:') ? value.indexOf(',') : -1
  const base64 = comma === -1 ? value : value.slice(comma + 1)
  if (!/^[A-Za-z0-9+/=\s]+$/.test(base64.slice(0, 64))) return undefined
  const mediaType = comma === -1 ? 'image/png' : value.slice(5, value.indexOf(';'))
  const data = Buffer.from(base64, 'base64')
  if (data.length === 0) return undefined
  return `data:${mediaType || 'image/png'};base64,${data.toString('base64')}`
}

function collectImages(parts, json) {
  const images = []
  for (const part of parts) {
    if (part.filename === undefined && !part.contentType?.startsWith('image/')) continue
    if (!['image', 'image[]', 'images', 'images[]'].includes(part.name)) continue
    images.push(toDataUrl(part))
  }
  for (const part of parts) {
    if (part.name !== 'reference_images') continue
    for (const candidate of String(part.data.toString('utf8')).split(',')) {
      const url = dataUrlImage(candidate.trim())
      if (url) images.push(url)
    }
  }
  const jsonImages = [
    ...(Array.isArray(json?.images) ? json.images : []),
    ...(json?.image === undefined ? [] : [json.image]),
  ]
  for (const entry of jsonImages) {
    const raw = typeof entry === 'string' ? entry : entry?.image_url?.url ?? entry?.image_url ?? entry?.url
    const url = dataUrlImage(raw)
    if (url) images.push(url)
  }
  return images.slice(0, MAX_IMAGES)
}

function fieldOf(parts, json, names, fallback) {
  for (const name of names) {
    const part = parts.find((candidate) => candidate.name === name && candidate.filename === undefined)
    if (part) {
      const value = part.data.toString('utf8').trim()
      if (value.length > 0) return value
    }
    const value = json?.[name]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return fallback
}

async function postUpstream(path, body, contentType) {
  const response = await fetch(`${UPSTREAM}${path}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  })
  return response
}

async function relay(response, res) {
  const text = await response.text()
  res.writeHead(response.status, {
    'content-type': response.headers.get('content-type') ?? 'application/json',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

async function handleEdit(req, res) {
  const contentType = req.headers['content-type'] ?? ''
  const raw = await readBody(req)
  let parts = []
  let json
  if (contentType.includes('multipart/form-data')) {
    const boundary = boundaryOf(contentType)
    if (boundary.length === 0) throw Object.assign(new Error('missing multipart boundary'), { status: 400 })
    parts = parseMultipart(raw, boundary)
  } else if (contentType.includes('application/json')) {
    try {
      json = JSON.parse(raw.toString('utf8'))
    } catch {
      throw Object.assign(new Error('invalid JSON body'), { status: 400 })
    }
  } else {
    throw Object.assign(new Error('Unsupported content type'), { status: 400 })
  }

  const prompt = fieldOf(parts, json, ['prompt', 'text'], undefined)
  if (prompt === undefined) throw Object.assign(new Error('missing prompt'), { status: 400 })
  const images = collectImages(parts, json)
  if (images.length === 0) throw Object.assign(new Error('missing source image'), { status: 400 })

  const size = fieldOf(parts, json, ['size'], undefined)
  const quality = fieldOf(parts, json, ['quality'], undefined)
  // The incoming `model` names the *image* model (e.g. gpt-image-2.5). The
  // Responses call needs a conversation model that can host the
  // image_generation tool, so keep the configured edit model unless the
  // client explicitly sends a non-image model name.
  const requested = fieldOf(parts, json, ['model'], undefined)
  const model = requested !== undefined && !/image/i.test(requested) ? requested : EDIT_MODEL

  const content = [{ type: 'input_text', text: prompt }]
  for (const imageUrl of images) content.push({ type: 'input_image', image_url: imageUrl })

  // Sprite work needs transparency, and the Responses image_generation tool
  // only emits alpha when asked for it explicitly. Default to a transparent
  // PNG and let a caller opt out with background=opaque.
  const background = fieldOf(parts, json, ['background'], SHIM_BACKGROUND)
  const outputFormat = fieldOf(parts, json, ['output_format', 'outputFormat'], SHIM_FORMAT)
  const tool = { type: 'image_generation' }
  if (size !== undefined && /^\d+x\d+$/.test(size)) tool.size = size
  if (quality !== undefined && quality !== 'auto') tool.quality = quality
  if (background === 'transparent' || background === 'opaque') tool.background = background
  if (outputFormat !== undefined && /^(png|jpeg|webp)$/i.test(outputFormat)) tool.output_format = outputFormat.toLowerCase()

  log('edit', { images: images.length, model, size, quality })

  const upstream = await postUpstream(
    '/v1/responses',
    JSON.stringify({ model, input: [{ role: 'user', content }], tools: [tool] }),
    'application/json',
  )
  const text = await upstream.text()
  if (!upstream.ok) {
    log('edit upstream failed', upstream.status, text.slice(0, 300))
    res.writeHead(upstream.status, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: { message: `upstream ${upstream.status}: ${text.slice(0, 800)}` } }))
    return
  }

  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw Object.assign(new Error('upstream returned invalid JSON'), { status: 502 })
  }

  const results = (Array.isArray(payload.output) ? payload.output : [])
    .filter((item) => item?.type === 'image_generation_call' && typeof item.result === 'string' && item.result.length > 0)
    .map((item) => ({ b64_json: item.result }))

  if (results.length === 0) {
    log('edit produced no image')
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: { message: 'upstream produced no image; check the prompt and tool support' } }))
    return
  }

  const body = JSON.stringify({ created: Math.floor(Date.now() / 1000), data: results })
  log('edit ok', { images: results.length, bytes: body.length })
  res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
  res.end(body)
}

async function handle(req, res) {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/healthz') {
    let upstream = 'unreachable'
    try {
      const probe = await fetch(`${UPSTREAM}/v1/models`, { signal: AbortSignal.timeout(4000) })
      upstream = probe.ok ? 'ok' : `http-${probe.status}`
    } catch (error) {
      upstream = `error: ${error?.message ?? error}`
    }
    const body = JSON.stringify({ ok: true, upstream, editModel: EDIT_MODEL, background: SHIM_BACKGROUND, port: PORT })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(body)
    return
  }

  if (req.method === 'POST' && (url.pathname === '/v1/images/generations' || url.pathname === '/v1/images/edits')) {
    if (url.pathname === '/v1/images/edits') {
      await handleEdit(req, res)
      return
    }
    const raw = await readBody(req)
    const upstream = await postUpstream(url.pathname, raw, req.headers['content-type'] ?? 'application/json')
    await relay(upstream, res)
    return
  }

  if (req.method === 'GET' && url.pathname.startsWith('/v1/models')) {
    const upstream = await fetch(`${UPSTREAM}${url.pathname}`, { signal: AbortSignal.timeout(10000) })
    await relay(upstream, res)
    return
  }

  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { message: `no route for ${req.method} ${url.pathname}` } }))
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    const status = error?.status ?? 502
    log('error', status, error?.message ?? error)
    if (!res.headersSent) res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: { message: error?.message ?? String(error) } }))
  })
})

server.listen(PORT, '127.0.0.1', () => {
  log(`image-edit shim listening on http://127.0.0.1:${PORT}`)
  log(`upstream=${UPSTREAM} editModel=${EDIT_MODEL}`)
})
