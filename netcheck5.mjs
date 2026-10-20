const t = [
  'https://registry.npmjs.org/dsh-balance-whale-widget',
  'https://api.github.com/repos/MeteorNOX/DeepSeek-Balance-Whale-Widget',
  'https://codeload.github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/tar.gz/refs/heads/main'
];
for (const u of t) {
  const s = Date.now();
  try { const r = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(15000) }); console.log(`OK   ${String(r.status).padEnd(4)} ${Date.now()-s}ms ${u}`); }
  catch (e) { console.log(`FAIL ${String(e.cause?.code ?? e.name).padEnd(14)} ${Date.now()-s}ms ${u}`); }
}
