import fs from 'node:fs';
const r = await fetch('https://codeload.github.com/DSH-EAC/EAC-skin-loader/tar.gz/refs/heads/main', { signal: AbortSignal.timeout(300000) });
console.log('status', r.status);
const b = Buffer.from(await r.arrayBuffer());
fs.writeFileSync('skin-src.tar.gz', b);
console.log('downloaded', b.length, 'bytes');
