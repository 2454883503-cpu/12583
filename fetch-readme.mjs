import fs from 'node:fs';
const api = 'https://api.github.com/repos/Ebony-Vinyl/dsh-our-free-model/contents/';
const j = await (await fetch(api + 'README.md')).json();
const t = Buffer.from(j.content, 'base64').toString('utf8');
fs.writeFileSync('ofm-repo/README.md', t);
console.log('README bytes:', t.length);
const lines = t.split('\n');
// print headings to understand the project structure
console.log('--- headings (first 60) ---');
console.log(lines.filter((l) => /^#{1,3} /.test(l)).slice(0, 60).join('\n'));
