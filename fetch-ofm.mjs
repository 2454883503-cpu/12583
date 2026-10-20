import fs from 'node:fs';
fs.mkdirSync('ofm-repo', { recursive: true });
const api = 'https://api.github.com/repos/Ebony-Vinyl/dsh-our-free-model/contents/';
for (const f of ['package.json', 'cordis.patch.yml']) {
  const j = await (await fetch(api + f)).json();
  const t = Buffer.from(j.content, 'base64').toString('utf8');
  fs.writeFileSync('ofm-repo/' + f, t);
  console.log('OK', f, t.length);
}
const tree = await (await fetch('https://api.github.com/repos/Ebony-Vinyl/dsh-our-free-model/git/trees/main?recursive=1')).json();
console.log('total files:', tree.tree.length, 'truncated:', tree.truncated);
const dirs = {};
for (const e of tree.tree) { const d = e.path.split('/')[0]; dirs[d] = (dirs[d] ?? 0) + 1; }
console.log('--- top-level dirs by file count ---');
console.log(Object.entries(dirs).sort((a,b)=>b[1]-a[1]).map(([d,c])=>`${d}: ${c}`).join('\n'));
fs.writeFileSync('ofm-repo/tree.json', JSON.stringify(tree.tree, null, 2));
