// Does the client bundle get served to the browser? client-modules roster.
const base = 'http://127.0.0.1:19387';
const tries = ['/api/client-modules', '/api/client-modules/roster', '/client-modules.json'];
for (const p of tries) {
  try {
    const r = await fetch(base + p, { signal: AbortSignal.timeout(6000) });
    const t = (await r.text()).slice(0, 300);
    console.log(`${String(r.status).padEnd(4)} ${p}  ${t.replace(/\s+/g,' ').slice(0,150)}`);
  } catch (e) { console.log(`FAIL ${p}`); }
}
