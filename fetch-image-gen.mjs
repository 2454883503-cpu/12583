import fs from 'node:fs';
fs.mkdirSync('image-gen-repo', { recursive: true });
const api = 'https://api.github.com/repos/LeemanCheung/dsh-image-gen/contents/';
for (const f of ['package.json', 'cordis.patch.yml', 'README.zh.md']) {
  const r = await fetch(api + f);
  if (!r.ok) { console.log('FAIL', f, r.status); continue; }
  const j = await r.json();
  const text = Buffer.from(j.content, 'base64').toString('utf8');
  fs.writeFileSync('image-gen-repo/' + f, text);
  console.log('OK', f, text.length, 'bytes');
}
const tree = await (await fetch('https://api.github.com/repos/LeemanCheung/dsh-image-gen/git/trees/main?recursive=1')).json();
const lib = tree.tree.filter((e) => /^(lib|assets)\//.test(e.path));
console.log('--- committed build output (' + lib.length + ' files) ---');
console.log(lib.slice(0, 20).map((e) => `${e.path} ${e.size ?? ''}`).join('\n'));
console.log('--- head commit ---');
const br = await (await fetch('https://api.github.com/repos/LeemanCheung/dsh-image-gen/commits/main')).json();
console.log(br.sha, '|', br.commit?.message?.split('\n')[0], '|', br.commit?.author?.date);
