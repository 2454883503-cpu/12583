const targets = ['https://registry.npmjs.org/dsh-image-gen', 'https://api.github.com', 'https://github.com', 'https://codeload.github.com/LeemanCheung/dsh-image-gen/tar.gz/refs/heads/main'];
for (const u of targets) {
  const started = Date.now();
  try {
    const c = AbortSignal.timeout(12000);
    const r = await fetch(u, { signal: c, method: 'HEAD' });
    console.log(`OK   ${String(r.status).padEnd(4)} ${Date.now() - started}ms  ${u}`);
  } catch (e) {
    console.log(`FAIL ${String(e.cause?.code ?? e.name).padEnd(4)} ${Date.now() - started}ms  ${u}`);
  }
}
