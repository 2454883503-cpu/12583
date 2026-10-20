// Parse and summarize a DSH cordis.patch.yml with the harness's own js-yaml.
//
// Usage: node tools/check-patch-yaml.mjs <cordis.patch.yml> <path/to/js-yaml.mjs>

const [patchPath, yamlModule] = process.argv.slice(2);
if (!patchPath) {
  console.error('usage: node check-patch-yaml.mjs <patch.yml> [js-yaml.mjs]');
  process.exit(2);
}

const { pathToFileURL } = await import('node:url');
const yaml = yamlModule
  ? await import(pathToFileURL(yamlModule).href)
  : await import('js-yaml');

const { readFile } = await import('node:fs/promises');
const text = await readFile(patchPath, 'utf8');

// DSH allows `!!js` expressions. js-yaml has no Type object for that tag, so
// strip the tag before parsing (the expression itself stays as a string, which
// is all a structural check needs).
const cleaned = text.replace(/(^|\s)!!js(?=\s|$)/g, '$1');
const doc = yaml.load(cleaned);

if (!Array.isArray(doc)) {
  console.error(`FAIL: top level is ${typeof doc}, expected a YAML array`);
  process.exit(1);
}

console.log(`[ok] parsed as a YAML array with ${doc.length} top-level entries`);
let ids = [];
for (const entry of doc) {
  if (entry && entry.insert) {
    for (const nested of entry.insert) ids.push(nested.id);
    continue;
  }
  if (entry && entry.id) ids.push(entry.id);
}
console.log(`     ids (top-level + inserted): ${ids.length}`);
console.log(`     ${ids.join(', ')}`);

const gs = doc.find((e) => e && e.id === 'gpt-quota');
const ba = doc.find((e) => e && e.insert)?.insert?.find?.((e) => e.id === 'gpt-bridge-autostart');
console.log(`     gpt-quota            : ${gs ? gs.name : '(absent)'}`);
console.log(`     gpt-bridge-autostart : ${ba ? ba.name : '(absent)'}`);
