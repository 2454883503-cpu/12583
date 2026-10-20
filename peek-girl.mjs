import fs from 'node:fs';
const repo = 'xpy12367/codex-pet-DeepSeek-girl';
const api = `https://api.github.com/repos/${repo}/contents/`;
for (const f of ['pet.json', 'README.md', 'LICENSE']) {
  const r = await fetch(api + f);
  if (!r.ok) { console.log('MISS', f, r.status); continue; }
  const j = await r.json();
  const t = Buffer.from(j.content, 'base64').toString('utf8');
  console.log(`\n===== ${f} =====`);
  console.log(t.slice(0, 2200));
}
