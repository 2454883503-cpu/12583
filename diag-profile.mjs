import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const P = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const m = JSON.parse(fs.readFileSync(P + 'package.json', 'utf8'));
console.log('bundles:', m.dsh.profile.bundles.join(', '));
console.log('deps   :', Object.keys(m.dependencies).join(', '));
const inBundles = new Set(m.dsh.profile.bundles);
for (const d of Object.keys(m.dependencies)) {
  if (!inBundles.has(d)) console.log(`  -> INACTIVE (依赖在但不在 bundles): ${d}`);
}
const patch = yaml.load(fs.readFileSync(P + 'cordis.patch.yml', 'utf8')) ?? [];
const dis = patch.filter((e) => e.config && e.config.enabled === false);
console.log('\nrows with enabled:false in user patch:');
for (const e of dis) console.log(`  - ${e.id} (${e.name})`);
const disabled = patch.filter((e) => e.disabled === true);
console.log('rows with disabled:true:', disabled.map((e) => e.id).join(', ') || '(none)');
