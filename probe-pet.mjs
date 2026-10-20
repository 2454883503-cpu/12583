// Check the pet's own API surface, and whether its host half is mounted.
const base = 'http://127.0.0.1:19387';
for (const p of ['/api/desktop-pet/version', '/api/desktop-pet/status', '/api/desktop-pet']) {
  try {
    const r = await fetch(base + p, { signal: AbortSignal.timeout(5000) });
    console.log(`${String(r.status).padEnd(4)} ${p}  ${(await r.text()).slice(0,160).replace(/\s+/g,' ')}`);
  } catch (e) { console.log(`FAIL ${p}  ${e.cause?.code ?? e.name}`); }
}
