import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const P = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const m = JSON.parse(fs.readFileSync(P + 'package.json', 'utf8'));
console.log('=== bundles (' + m.dsh.profile.bundles.length + ') ===');
console.log(m.dsh.profile.bundles.join('\n  '));
const inB = new Set(m.dsh.profile.bundles);
const inactive = Object.keys(m.dependencies).filter((d) => !inB.has(d));
console.log('\ninactive (dep but not bundle):', inactive.length ? inactive.join(', ') : '(none)');
const patch = yaml.load(fs.readFileSync(P + 'cordis.patch.yml', 'utf8')) ?? [];
console.log('patch parses OK, entries:', patch.length);
const settingsRow = patch.find((e) => e.id === 'ui-settings');
console.log('ui-settings enabled =', settingsRow?.config?.enabled);
// build overlay for a real compose check
let all = [];
for (const b of m.dsh.profile.bundles) {
  if (b.startsWith('@deepseek-ai/')) continue;
  const dir = P + 'node_modules/' + b;
  const pm = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
  const rel = pm.dsh?.bundle?.patch;
  if (rel) all = all.concat(yaml.load(fs.readFileSync(dir + '/' + rel.replace(/^\.\//, ''), 'utf8')) ?? []);
}
fs.writeFileSync('overlay-fixed.yml', yaml.dump(all.concat(patch), { lineWidth: 200 }));
console.log('\noverlay entries:', all.length + patch.length);
