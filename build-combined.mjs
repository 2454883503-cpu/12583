import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const P = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const order = ['dsh-desktop-pet', 'dsh-session-sync', 'dsh-image-gen', 'dsh-plugin-manager-plus'];
let combined = [];
for (const b of order) {
  const y = yaml.load(fs.readFileSync(P + 'node_modules/' + b + '/cordis.patch.yml', 'utf8')) ?? [];
  combined = combined.concat(y);
  console.log(`${b}: ${y.length} patch entr(ies)`);
}
const user = yaml.load(fs.readFileSync(P + 'cordis.patch.yml', 'utf8')) ?? [];
combined = combined.concat(user);
console.log(`user patch: ${user.length} entr(ies)`);
fs.writeFileSync('combined-desktop-overlay.yml', yaml.dump(combined, { lineWidth: 200 }));
console.log('combined overlay entries:', combined.length);
const ids = combined.filter((e) => e.id).map((e) => e.id);
const inserts = combined.flatMap((e) => (e.insert ?? []).map((i) => i.id));
console.log('ids overridden :', ids.join(', ') || '(none)');
console.log('ids inserted   :', inserts.join(', '));
const dupes = inserts.filter((x, i) => inserts.indexOf(x) !== i);
console.log('duplicate inserts:', dupes.length ? dupes.join(', ') : '(none)');
