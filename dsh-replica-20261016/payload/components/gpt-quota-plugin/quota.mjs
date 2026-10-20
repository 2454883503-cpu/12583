import fs from 'node:fs/promises';
import net from 'node:net';
import tls from 'node:tls';
import https from 'node:https';

const HOST = 'chatgpt.com';
const PATH = '/backend-api/wham/usage';
const MAX_BODY = 1024 * 1024;
/** The local HTTP proxy used to reach chatgpt.com. Override with the
 * DSH_LOCAL_PROXY environment variable when the proxy listens elsewhere.
 * REPLICA NOTE: this replaced the previously hard-coded 'http://127.0.0.1:7892'
 * so the plugin survives a move to a machine with a different proxy port.
 */
export function defaultProxyURL() {
  const configured = process.env.DSH_LOCAL_PROXY;
  return typeof configured === 'string' && configured.trim() ? configured.trim() : 'http://127.0.0.1:7892';
}

// Credentials and raw upstream bodies never leave this module.
function requestUsage(auth, proxyURL) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const sockets = new Set();
    let request;
    const agent = new https.Agent({ keepAlive: false });
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      request?.destroy();
      for (const socket of sockets) socket.destroy();
      agent.destroy();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('timeout')), 15000);
    agent.createConnection = (_options, callback) => {
      let proxy;
      try {
        proxy = new URL(proxyURL);
        if (proxy.protocol !== 'http:' || proxy.username || proxy.password) throw new Error();
      } catch { finish(new Error('proxy')); return; }
      const tunnel = net.connect({ host: proxy.hostname, port: Number(proxy.port || 80) });
      sockets.add(tunnel);
      const fail = () => finish(new Error('network'));
      tunnel.on('error', fail);
      tunnel.once('connect', () => {
        tunnel.write(`CONNECT ${HOST}:443 HTTP/1.1\r\nHost: ${HOST}:443\r\nConnection: keep-alive\r\n\r\n`);
      });
      let header = Buffer.alloc(0);
      const onData = chunk => {
        header = Buffer.concat([header, chunk]);
        const end = header.indexOf('\r\n\r\n');
        if (end < 0) {
          if (header.length > 16384) finish(new Error('proxy'));
          return;
        }
        if (end > 16384 || !/^HTTP\/1\.[01] 200(?:\s|\r)/.test(header.toString('latin1', 0, end))) {
          finish(new Error('proxy')); return;
        }
        tunnel.removeListener('data', onData);
        tunnel.pause();
        const rest = header.subarray(end + 4);
        if (rest.length) tunnel.unshift(rest);
        const secure = tls.connect({ socket: tunnel, servername: HOST, rejectUnauthorized: true });
        sockets.add(secure);
        secure.on('error', fail);
        secure.once('secureConnect', () => callback(null, secure));
        tunnel.resume();
      };
      tunnel.on('data', onData);
      tunnel.once('end', () => { if (!settled) finish(new Error('network')); });
      // Asynchronous Agent.createConnection: callback supplies the TLS socket.
      return undefined;
    };
    request = https.request({
      hostname: HOST, port: 443, path: PATH, method: 'GET', agent,
      headers: {
        Authorization: `Bearer ${auth.tokens.access_token}`,
        'ChatGPT-Account-ID': auth.tokens.account_id,
        Accept: 'application/json', 'User-Agent': 'codex-cli',
      },
    }, response => {
      if (response.statusCode !== 200) {
        const error = new Error('upstream');
        error.status = response.statusCode;
        finish(error); return; // In particular, never follow redirects.
      }
      let length = 0;
      const chunks = [];
      response.on('data', chunk => {
        length += chunk.length;
        if (length > MAX_BODY) { finish(new Error('invalid')); return; }
        chunks.push(chunk);
      });
      response.on('error', () => finish(new Error('network')));
      response.on('end', () => {
        if (settled) return;
        try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { finish(new Error('invalid')); }
      });
    });
    request.on('error', () => finish(new Error('network')));
    request.end();
  });
}

function normalizeWindow(value) {
  if (!value || !Number.isFinite(value.used_percent) || value.used_percent < 0 ||
      !Number.isFinite(value.limit_window_seconds) || value.limit_window_seconds <= 0 ||
      !Number.isFinite(value.reset_at) || value.reset_at < 0) return null;
  return {
    remainingPercent: Math.max(0, Math.min(100, 100 - value.used_percent)),
    usedPercent: value.used_percent,
    resetAt: value.reset_at, // Unix seconds, not milliseconds.
    windowSeconds: value.limit_window_seconds,
  };
}

function normalize(payload) {
  const windows = { fiveHour: null, week: null };
  for (const candidate of [payload?.rate_limit?.primary_window, payload?.rate_limit?.secondary_window]) {
    const window = normalizeWindow(candidate);
    if (window?.windowSeconds === 18000) windows.fiveHour = window;
    if (window?.windowSeconds === 604800) windows.week = window;
  }
  if (!windows.fiveHour && !windows.week) throw new Error('invalid');
  return {
    windows,
    fetchedAt: new Date().toISOString(),
    stale: false,
    error: null,
  };
}

/** Read-only account quota reader; does not refresh or write OAuth credentials.
 * resetAt is Unix seconds; fetchedAt is ISO 8601. Missing windows remain null.
 * A stale response retains the last successful fetchedAt, never inventing usage.
 */
export function createQuotaReader({ authPath, proxyURL = defaultProxyURL() } = {}) {
  if (typeof authPath !== 'string' || !authPath) throw new TypeError('authPath is required');
  let snapshot = { windows: { fiveHour: null, week: null }, fetchedAt: null, stale: true, error: 'Usage not fetched.' };
  let lastAttempt = -Infinity;
  let inFlight = null;
  return async function read({ force = false } = {}) {
    if (inFlight) return structuredClone(await inFlight);
    if (Date.now() - lastAttempt < (force ? 5000 : 30000)) return structuredClone(snapshot);
    lastAttempt = Date.now();
    inFlight = (async () => {
      try {
        let auth;
        try { auth = JSON.parse(await fs.readFile(authPath, 'utf8')); }
        catch { throw new Error('auth'); }
        if (typeof auth?.tokens?.access_token !== 'string' || !auth.tokens.access_token ||
            typeof auth?.tokens?.account_id !== 'string' || !auth.tokens.account_id) throw new Error('auth');
        snapshot = normalize(await requestUsage(auth, proxyURL));
      } catch (error) {
        const message = error.status === 401 ? 'Sign-in required; reload Codex credentials.' :
          error.status === 403 ? 'Usage access denied.' :
          error.status === 429 ? 'Usage service rate limited; retry later.' :
          error.message === 'auth' ? 'Codex credentials unavailable.' :
          error.message === 'timeout' ? 'Usage request timed out.' :
          error.message === 'invalid' ? 'Usage response unavailable.' : 'Usage service unavailable.';
        snapshot = { ...snapshot, stale: true, error: message };
      }
      return snapshot;
    })();
    try { return structuredClone(await inFlight); }
    finally { inFlight = null; }
  };
}
