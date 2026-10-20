const repo = 'xpy12367/codex-pet-DeepSeek-girl';
const api = `https://api.github.com/repos/${repo}/contents/`;
const r = await fetch(api + 'qa/package-validation.json');
const j = await r.json();
const v = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
const byRow = new Map();
for (const c of v.cells) {
  if (!byRow.has(c.row)) byRow.set(c.row, { state: c.state, used: 0, total: 0 });
  const e = byRow.get(c.row);
  e.total++;
  if (c.used) e.used++;
}
console.log('row | state            | used/total');
for (const [row, e] of [...byRow.entries()].sort((a,b)=>a[0]-b[0])) {
  console.log(`${String(row).padEnd(3)} | ${e.state.padEnd(16)} | ${e.used}/${e.total}`);
}
