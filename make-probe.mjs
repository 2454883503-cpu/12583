import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const P = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const packDir = P + 'node_modules/@dsh-eac/skin-loader-pack';
const y = yaml.load(fs.readFileSync(packDir + '/cordis.patch.yml', 'utf8'));
// Write the SAME content to a file located inside the package, so the relative
// path anchors beside it exactly like a real bundle patch.
const probe = packDir + '/.__probe-patch.yml';
fs.writeFileSync(probe, yaml.dump(y));
console.log('probe written:', probe);
