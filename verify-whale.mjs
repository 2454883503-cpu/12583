import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const P = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const m = JSON.parse(fs.readFileSync(P + 'package.json', 'utf8'));
const user = yaml.load(fs.readFileSync(P + 'cordis.patch.yml', 'utf8')) ?? [];
const ins = [];
console.log('=== bundles (' + m.dsh.profile.bundles.length + ') ===');
for (const b of m.dsh.profile.bundles) {
  if (b.startsWith('@deepseek-ai/dsh-')) { console.log('  [core] ' + b); continue; }
  const dir = P + 'node_modules/' + b;
  const pm = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
  const rel = pm.dsh?.bundle?.patch;
  let ids = [];
  if (rel) {
    const y = yaml.load(fs.readFileSync(dir + '/' + rel.replace(/^\.\//, ''), 'utf8')) ?? [];
    ids = y.flatMap((e) => (e.insert ?? []).map((i) => i.id));
    for (const i of ids) ins.push(i);
  }
  console.log(`  ${b.padEnd(30)} ${String(pm.version).padEnd(8)} -> ${ids.join(', ') || '(core)'}`);
}
for (const e of user) for (const i of (e.insert ?? [])) ins.push(i.id);
const dup = ins.filter((x, i) => ins.indexOf(x) !== i);
console.log('\ninsert ids (' + ins.length + '):', ins.join(', '));
console.log('duplicate inserts:', dup.length ? dup.join(', ') : '(none)  <-- OK');
