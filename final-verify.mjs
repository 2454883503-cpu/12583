import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const p = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const manifest = JSON.parse(fs.readFileSync(p + 'package.json', 'utf8'));
const patch = yaml.load(fs.readFileSync(p + 'cordis.patch.yml', 'utf8'));
console.log('user patch entries:', patch.length, '(parses OK)');
console.log('dependencies:', JSON.stringify(manifest.dependencies));
console.log('bundles:', manifest.dsh.profile.bundles.join(' | '));
console.log('--- each installed plugin patch ---');
for (const b of ['dsh-desktop-pet', 'dsh-session-sync', 'dsh-image-gen']) {
  const m = JSON.parse(fs.readFileSync(p + 'node_modules/' + b + '/package.json', 'utf8'));
  const y = yaml.load(fs.readFileSync(p + 'node_modules/' + b + '/cordis.patch.yml', 'utf8')) ?? [];
  const ids = y.flatMap((e) => (e.insert ?? []).map((i) => 'insert:' + i.id)).concat(y.filter((e) => e.id && !e.insert).map((e) => 'override:' + e.id));
  console.log(`${b}@${m.version} -> ${ids.join(', ')}`);
}
console.log('--- stale LeemanCheung artifacts ---');
console.log('connection override gone?', !fs.readFileSync(p + 'cordis.patch.yml', 'utf8').includes('id: connection'));
console.log('exemptions:', fs.readFileSync(p + 'compatibility.json', 'utf8').trim());
