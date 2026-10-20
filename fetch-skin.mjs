import fs from 'node:fs';
const api = 'https://api.github.com/repos/Ebony-Vinyl/EAC-skin-loader/contents/';
for (const f of ['package.json', 'cordis.patch.yml']) {
  const r = await fetch(api + f);
  if (!r.ok) { console.log('MISS', f, r.status); continue; }
  const j = await r.json();
  const t = Buffer.from(j.content, 'base64').toString('utf8');
  fs.mkdirSync('skin-repo', { recursive: true });
  fs.writeFileSync('skin-repo/' + f, t);
  console.log('OK', f, t.length);
}
const tree = await (await fetch('https://api.github.com/repos/Ebony-Vinyl/EAC-skin-loader/git/trees/main?recursive=1')).json();
console.log('total files:', tree.tree.length, 'truncated:', tree.truncated);
const dirs = {};
for (const e of tree.tree) { const d = e.path.split('/')[0]; dirs[d] = (dirs[d] ?? 0) + 1; }
console.log('--- top level ---');
console.log(Object.entries(dirs).sort((a,b)=>b[1]-a[1]).map(([d,c])=>`${d}: ${c}`).join('\n'));
fs.writeFileSync('skin-repo/tree.json', JSON.stringify(tree.tree, null, 2));
