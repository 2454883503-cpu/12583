const base = 'http://127.0.0.1:19387';
const paths = [
  '/api/our-free-model/version',
  '/api/definitely-not-a-real-plugin/version',
  '/api/our-free-model/nonexistent-route-xyz'
];
for (const p of paths) {
  try {
    const r = await fetch(base + p, { signal: AbortSignal.timeout(8000) });
    const txt = (await r.text()).slice(0, 200);
    console.log(`${String(r.status).padEnd(4)} ${p}`);
    console.log('      ' + txt.replace(/\s+/g, ' ').slice(0, 180));
  } catch (e) { console.log(`FAIL ${p} ${e.cause?.code ?? e.name}`); }
}
