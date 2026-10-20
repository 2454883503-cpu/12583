import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const P = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const patch = yaml.load(fs.readFileSync(P + 'cordis.patch.yml', 'utf8'));
console.log('patch parses OK, entries:', patch.length);
const pet = patch.find((e) => e.id === 'desktop-pet');
console.log('desktop-pet override:', JSON.stringify(pet, null, 2));
// Ensure no duplicate insert of desktop-pet anywhere
const ins = [];
const m = JSON.parse(fs.readFileSync(P + 'package.json', 'utf8'));
for (const b of m.dsh.profile.bundles) {
  if (b.startsWith('@deepseek-ai/dsh-')) continue;
  const dir = P + 'node_modules/' + b;
  const pm = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
  const rel = pm.dsh?.bundle?.patch;
  if (!rel) continue;
  const y = yaml.load(fs.readFileSync(dir + '/' + rel.replace(/^\.\//, ''), 'utf8')) ?? [];
  for (const e of y) for (const i of (e.insert ?? [])) ins.push(i.id);
}
for (const e of patch) for (const i of (e.insert ?? [])) ins.push(i.id);
const dup = ins.filter((x, i) => ins.indexOf(x) !== i);
console.log('\ninsert ids:', ins.join(', '));
console.log('duplicate inserts:', dup.length ? dup.join(', ') : '(none)  <-- OK');
