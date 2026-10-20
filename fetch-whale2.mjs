import fs from 'node:fs';
const api = 'https://api.github.com/repos/MeteorNOX/DeepSeek-Balance-Whale-Widget/contents/';
for (const f of ['lib/index.js', 'README.md', 'PROVENANCE.md']) {
  const r = await fetch(api + f);
  if (!r.ok) { console.log('MISS', f, r.status); continue; }
  const j = await r.json();
  const t = Buffer.from(j.content, 'base64').toString('utf8');
  fs.writeFileSync('whale-repo/' + f.replace(/\//g,'__'), t);
  console.log('OK', f, t.length);
}
const tree = JSON.parse(fs.readFileSync('whale-repo/tree.json', 'utf8'));
console.log('\n--- lib + tools files ---');
for (const e of tree) if (/^(lib|tools)\//.test(e.path)) console.log(`  ${String(e.size??'').padEnd(8)} ${e.path}`);
