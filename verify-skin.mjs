import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const P = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const m = JSON.parse(fs.readFileSync(P + 'package.json', 'utf8'));
const inB = new Set(m.dsh.profile.bundles);
console.log('bundles:', m.dsh.profile.bundles.length);
let all = [];
for (const b of m.dsh.profile.bundles) {
  if (b.startsWith('@deepseek-ai/dsh-')) continue;
  const dir = P + 'node_modules/' + b;
  const pm = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
  const rel = pm.dsh?.bundle?.patch;
  let ids = [];
  if (rel) {
    const y = yaml.load(fs.readFileSync(dir + '/' + rel.replace(/^\.\//, ''), 'utf8')) ?? [];
    ids = y.flatMap((e) => (e.insert ?? []).map((i) => i.id));
    all = all.concat(y);
  }
  console.log(`  ${b.padEnd(30)} ${pm.version.padEnd(8)} -> ${ids.join(', ') || '(core)'}`);
}
const user = yaml.load(fs.readFileSync(P + 'cordis.patch.yml', 'utf8')) ?? [];
all = all.concat(user);
const ins = all.flatMap((e) => (e.insert ?? []).map((i) => i.id));
const dup = ins.filter((x, i) => ins.indexOf(x) !== i);
console.log('\nall insert ids:', ins.join(', '));
console.log('duplicates:', dup.length ? dup.join(', ') : '(none)');
fs.writeFileSync('overlay-skin.yml', yaml.dump(all, { lineWidth: 200 }));
console.log('overlay entries:', all.length);
