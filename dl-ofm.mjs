import fs from 'node:fs';
const r = await fetch('https://codeload.github.com/Ebony-Vinyl/dsh-our-free-model/tar.gz/refs/heads/main');
console.log('status', r.status);
const b = Buffer.from(await r.arrayBuffer());
fs.writeFileSync('ofm-src.tar.gz', b);
console.log('downloaded', b.length, 'bytes');
