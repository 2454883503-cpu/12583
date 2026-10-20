import fs from 'node:fs';
const url = 'https://codeload.github.com/LeemanCheung/dsh-image-gen/tar.gz/refs/tags/v0.4.1';
const r = await fetch(url);
console.log('status', r.status);
const b = Buffer.from(await r.arrayBuffer());
fs.writeFileSync('dsh-image-gen-v0.4.1.tar.gz', b);
console.log('downloaded', b.length, 'bytes');
