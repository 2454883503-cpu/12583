import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const P = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const m = JSON.parse(fs.readFileSync(P + 'package.json', 'utf8'));
console.log('=== bundles & their rows ===');
for (const b of m.dsh.profile.bundles) {
  if (b.startsWith('@deepseek-ai/dsh-')) { console.log('  [core] ' + b); continue; }
  const dir = P + 'node_modules/' + b;
  if (!fs.existsSync(dir + '/package.json')) { console.log('  [MISSING DIR] ' + b); continue; }
  const pm = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
  const rel = pm.dsh?.bundle?.patch;
  let ids = '(no patch)';
  if (rel) {
    const y = yaml.load(fs.readFileSync(dir + '/' + rel.replace(/^\.\//, ''), 'utf8')) ?? [];
    ids = y.flatMap((e) => (e.insert ?? []).map((i) => i.id)).concat(y.filter((e)=>e.id&&!e.insert).map((e)=>'ovr:'+e.id)).join(', ') || '(empty)';
  }
  console.log(`  ${b.padEnd(30)} ${String(pm.version).padEnd(9)} -> ${ids}`);
}
const user = yaml.load(fs.readFileSync(P + 'cordis.patch.yml', 'utf8')) ?? [];
const petOverride = user.find((e) => e.id === 'desktop-pet');
console.log('\n=== user patch: desktop-pet override? ===');
console.log(petOverride ? JSON.stringify(petOverride) : '(none)');
