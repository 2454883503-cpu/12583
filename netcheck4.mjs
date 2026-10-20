const t = [
  'https://codeload.github.com/DSH-EAC/EAC-skin-loader/tar.gz/refs/heads/main',
  'https://api.github.com/repos/DSH-EAC/EAC-skin-loader/releases/latest',
  'https://github.com/DSH-EAC/EAC-skin-loader/releases/latest'
];
for (const u of t) {
  const s = Date.now();
  try { const r = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(12000) }); console.log(`OK   ${String(r.status).padEnd(4)} ${Date.now()-s}ms ${u}`); }
  catch (e) { console.log(`FAIL ${String(e.cause?.code ?? e.name).padEnd(14)} ${Date.now()-s}ms ${u}`); }
}
