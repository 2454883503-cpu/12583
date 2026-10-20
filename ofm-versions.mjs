import fs from 'node:fs';
const j = await (await fetch('https://registry.npmjs.org/dsh-our-free-model')).json();
console.log('=== all versions ===');
for (const [v, m] of Object.entries(j.versions)) {
  console.log(`${v.padEnd(8)} ${j.time[v]}  deprecated=${m.deprecated ? 'YES' : 'no'}`);
}
console.log('dist-tags:', JSON.stringify(j['dist-tags']));
console.log('maintainers (history):', JSON.stringify(j.maintainers));
console.log('time.modified:', j.time.modified);
const latest = j.versions[j['dist-tags'].latest];
console.log('\n=== deprecation notice (full) ===');
console.log(j['dist-tags'].latest + ': ' + (latest.deprecated ?? '(none)'));
