import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const p = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const manifest = JSON.parse(fs.readFileSync(p + 'package.json', 'utf8'));
const patch = yaml.load(fs.readFileSync(p + 'cordis.patch.yml', 'utf8'));
console.log('user patch entries:', patch.length, '(parses OK)');
console.log('bundles:', manifest.dsh.profile.bundles.join(' | '));
for (const b of ['dsh-desktop-pet', 'dsh-session-sync', 'dsh-image-gen']) {
  const m = JSON.parse(fs.readFileSync(p + 'node_modules/' + b + '/package.json', 'utf8'));
  const y = yaml.load(fs.readFileSync(p + 'node_modules/' + b + '/cordis.patch.yml', 'utf8'));
  const ids = (y ?? []).flatMap((e) => (e.insert ?? []).map((i) => i.id)).concat((y ?? []).filter((e) => e.id).map((e) => 'override:' + e.id));
  console.log(`${b}@${m.version} patch ids -> ${ids.join(', ')}`);
}
const r = await fetch('https://registry.npmjs.org/dsh-codex-connect');
if (r.ok) { const j = await r.json(); console.log('npm dsh-codex-connect:', j['dist-tags'].latest, '| repo:', j.versions[j['dist-tags'].latest].repository?.url); }
else console.log('npm dsh-codex-connect:', r.status, '(not published under that exact name)');
