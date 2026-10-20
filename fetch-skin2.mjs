import fs from 'node:fs';
const api = 'https://api.github.com/repos/Ebony-Vinyl/EAC-skin-loader/contents/';
for (const f of ['README.md', 'packages/loader/package.json', 'packages/loader/cordis.patch.yml', 'packages/loader/skin-manifest.json']) {
  const r = await fetch(api + f);
  if (!r.ok) { console.log('MISS', f, r.status); continue; }
  const j = await r.json();
  const t = Buffer.from(j.content, 'base64').toString('utf8');
  const dest = 'skin-repo/' + f.replace(/\//g, '__');
  fs.writeFileSync(dest, t);
  console.log('OK', f, t.length, '->', dest);
}
