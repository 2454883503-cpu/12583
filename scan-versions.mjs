const r = await fetch('https://registry.npmjs.org/dsh-session-sync');
const j = await r.json();
const rows = [];
for (const [v, m] of Object.entries(j.versions)) {
  rows.push([v, m.engines?.dsh ?? '', m.peerDependencies?.['@deepseek-ai/cordis'] ?? '', m.peerDependencies?.['@deepseek-ai/schemastery'] ?? '']);
}
for (const [v, e, c, s] of rows) {
  const okDsh = /0\.2\.0-0/.test(e) || /0\.3\.0/.test(e);
  console.log(`${v.padEnd(9)} dsh0200=${okDsh ? 'Y' : 'n'} cordis=${c.padEnd(18)} schema=${s}`);
}
console.log('total versions:', rows.length, 'latest:', j['dist-tags'].latest);
