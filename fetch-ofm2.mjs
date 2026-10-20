import fs from 'node:fs';
const api = 'https://api.github.com/repos/Ebony-Vinyl/dsh-our-free-model/contents/';
// Grab the host entry + a couple of src files for endpoint analysis
for (const f of ['index.js']) {
  const j = await (await fetch(api + f)).json();
  const t = Buffer.from(j.content, 'base64').toString('utf8');
  fs.writeFileSync('ofm-repo/' + f, t);
  console.log('OK', f, t.length);
}
const src = JSON.parse(fs.readFileSync('ofm-repo/tree.json', 'utf8')).filter((e) => e.path.startsWith('src/'));
console.log('--- src files ---');
console.log(src.map((e) => e.path).join('\n'));
