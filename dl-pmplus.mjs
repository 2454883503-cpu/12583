import fs from 'node:fs';
const url = 'https://registry.npmjs.org/dsh-plugin-manager-plus/-/dsh-plugin-manager-plus-1.3.4.tgz';
const r = await fetch(url);
const b = Buffer.from(await r.arrayBuffer());
fs.writeFileSync('dsh-plugin-manager-plus-1.3.4.tgz', b);
console.log('downloaded', b.length, 'bytes');
