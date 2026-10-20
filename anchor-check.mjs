import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const P = 'C:/Users/tanyu/.dsh/profiles/desktop/';
// The bundle's own patch file lives inside the package; simulate anchoring there.
const packDir = P + 'node_modules/@dsh-eac/skin-loader-pack';
const y = yaml.load(fs.readFileSync(packDir + '/cordis.patch.yml', 'utf8'));
console.log('pack root patch:', JSON.stringify(y, null, 2));
const loaderPatch = yaml.load(fs.readFileSync(packDir + '/packages/loader/cordis.patch.yml', 'utf8'));
console.log('\nloader sub-package patch:', JSON.stringify(loaderPatch, null, 2));
