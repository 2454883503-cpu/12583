// Validate the desktop profile patch file the same way the loader parses it.
//   node validate-patch.cjs <path-to-cordis.patch.yml>
const fs = require('node:fs');
const YAML = require('C:/Users/tanyu/dsh/node_modules/yaml');

const file = process.argv[2];
const doc = YAML.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(doc)) throw new Error('top level is not an array');
console.log('parsed ok; entries =', doc.length);
for (const e of doc) {
  console.log(' -', e.id, '|', e.name || '(no name)', '| config:', e.config ? Object.keys(e.config).join(',') : '(none)');
}
const pi = doc.find((e) => e.id === 'llm-pi-ai');
console.log('--- llm-pi-ai row ---');
console.log(JSON.stringify(pi, null, 2));
