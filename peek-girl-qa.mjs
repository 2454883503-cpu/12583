import fs from 'node:fs';
const repo = 'xpy12367/codex-pet-DeepSeek-girl';
const api = `https://api.github.com/repos/${repo}/contents/`;
for (const f of ['qa/package-validation.json', 'qa/final-visual-qa.json', 'qa/run-summary.json']) {
  const r = await fetch(api + f);
  if (!r.ok) { console.log('MISS', f, r.status); continue; }
  const j = await r.json();
  const t = Buffer.from(j.content, 'base64').toString('utf8');
  console.log(`\n===== ${f} =====`);
  console.log(t.slice(0, 1800));
}
