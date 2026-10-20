import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const P = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const m = JSON.parse(fs.readFileSync(P + 'package.json', 'utf8'));
const user = yaml.load(fs.readFileSync(P + 'cordis.patch.yml', 'utf8')) ?? [];
const ins = [];
const ovr = [];
for (const b of m.dsh.profile.bundles) {
  if (b.startsWith('@deepseek-ai/dsh-')) continue;
  const dir = P + 'node_modules/' + b;
  const pm = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
  const rel = pm.dsh?.bundle?.patch;
  if (!rel) continue;
  const y = yaml.load(fs.readFileSync(dir + '/' + rel.replace(/^\.\//, ''), 'utf8')) ?? [];
  for (const e of y) {
    for (const i of (e.insert ?? [])) ins.push(i.id);
    if (e.id && !e.insert) ovr.push(e.id);
  }
}
for (const e of user) {
  for (const i of (e.insert ?? [])) ins.push(i.id);
  if (e.id && !e.insert) ovr.push(e.id);
}
const all = [...ins, ...ovr];
const dup = all.filter((x, i) => all.indexOf(x) !== i);
console.log('insert ids :', ins.join(', '));
console.log('override ids:', ovr.join(', '));
console.log('duplicates  :', dup.length ? dup.join(', ') : '(none)');
console.log('\nskin loader row present:', ins.includes('dsh-ui-skin-loader'));
console.log('image-gen override (not insert):', ovr.includes('image-gen'));
