const t = ['https://registry.npmjs.org/dsh-our-free-model', 'https://registry.npmjs.org/@ebony-vinyl%2Fdsh-our-free-model', 'https://api.github.com/repos/Ebony-Vinyl/dsh-our-free-model', 'https://codeload.github.com/Ebony-Vinyl/dsh-our-free-model/tar.gz/refs/heads/main'];
for (const u of t) {
  const s = Date.now();
  try { const r = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(15000) }); console.log(`OK   ${String(r.status).padEnd(4)} ${Date.now()-s}ms ${u}`); }
  catch (e) { console.log(`FAIL ${String(e.cause?.code ?? e.name).padEnd(14)} ${Date.now()-s}ms ${u}`); }
}
