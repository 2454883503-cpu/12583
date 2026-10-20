import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const P = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const m = JSON.parse(fs.readFileSync(P + 'package.json', 'utf8'));
const user = yaml.load(fs.readFileSync(P + 'cordis.patch.yml', 'utf8')) ?? [];
let all = [];
for (const b of m.dsh.profile.bundles) {
  if (b.startsWith('@deepseek-ai/dsh-')) continue;
  const dir = P + 'node_modules/' + b;
  const pm = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
  const rel = pm.dsh?.bundle?.patch;
  if (rel) all = all.concat(yaml.load(fs.readFileSync(dir + '/' + rel.replace(/^\.\//, ''), 'utf8')) ?? []);
}
all = all.concat(user);
fs.writeFileSync('overlay-whale.yml', yaml.dump(all, { lineWidth: 200 }));
console.log('overlay entries:', all.length);
