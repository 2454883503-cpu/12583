import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const P = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const manifest = JSON.parse(fs.readFileSync(P + 'package.json', 'utf8'));
const bundles = manifest.dsh.profile.bundles;
console.log('=== bundles (' + bundles.length + ') ===');
let all = [];
for (const b of bundles) {
  if (b.startsWith('@deepseek-ai/')) { console.log('  [core] ' + b); continue; }
  const dir = P + 'node_modules/' + b;
  if (!fs.existsSync(dir + '/package.json')) { console.log('  [MISSING] ' + b); continue; }
  const m = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
  const patchRel = m.dsh?.bundle?.patch;
  let ids = '(no patch)';
  if (patchRel) {
    const y = yaml.load(fs.readFileSync(dir + '/' + patchRel.replace(/^\.\//, ''), 'utf8')) ?? [];
    const ins = y.flatMap((e) => (e.insert ?? []).map((i) => i.id));
    const ovr = y.filter((e) => e.id && !e.insert).map((e) => 'override:' + e.id);
    ids = ins.concat(ovr).join(', ') || '(empty)';
    all = all.concat(y);
  }
  console.log(`  [plugin] ${b}@${m.version}  -> ${ids}`);
}
const ids = all.flatMap((e) => (e.insert ?? []).map((i) => i.id));
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
console.log('\ninsert ids:', ids.join(', '));
console.log('duplicates:', dup.length ? dup.join(', ') : '(none)');
fs.writeFileSync('overlay-all.yml', yaml.dump(all, { lineWidth: 200 }));
console.log('overlay written, entries:', all.length);
