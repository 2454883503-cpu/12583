const base = 'http://127.0.0.1:19387';
const paths = ['/api/our-free-model/version', '/api/our-free-model/status', '/api/settings/describe'];
for (const p of paths) {
  const t = Date.now();
  try {
    const r = await fetch(base + p, { signal: AbortSignal.timeout(8000) });
    const txt = (await r.text()).slice(0, 400);
    console.log(`${String(r.status).padEnd(4)} ${Date.now()-t}ms ${p}`);
    console.log('      ' + txt.replace(/\s+/g, ' ').slice(0, 300));
  } catch (e) {
    console.log(`FAIL ${String(e.cause?.code ?? e.name).padEnd(12)} ${p}`);
  }
}
