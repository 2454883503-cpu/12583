import fs from 'node:fs';
fs.mkdirSync('whale-repo', { recursive: true });
const api = 'https://api.github.com/repos/MeteorNOX/DeepSeek-Balance-Whale-Widget/contents/';
for (const f of ['package.json', 'cordis.patch.yml']) {
  const r = await fetch(api + f);
  if (!r.ok) { console.log('MISS', f, r.status); continue; }
  const j = await r.json();
  const t = Buffer.from(j.content, 'base64').toString('utf8');
  fs.writeFileSync('whale-repo/' + f, t);
  console.log('OK', f, t.length);
}
const tree = await (await fetch('https://api.github.com/repos/MeteorNOX/DeepSeek-Balance-Whale-Widget/git/trees/main?recursive=1')).json();
console.log('total files:', tree.tree.length);
const dirs = {};
for (const e of tree.tree) { const d = e.path.split('/')[0]; dirs[d] = (dirs[d] ?? 0) + 1; }
console.log(Object.entries(dirs).sort((a,b)=>b[1]-a[1]).map(([d,c])=>`  ${d}: ${c}`).join('\n'));
fs.writeFileSync('whale-repo/tree.json', JSON.stringify(tree.tree, null, 2));
