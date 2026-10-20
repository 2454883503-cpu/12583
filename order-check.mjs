import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const yaml = require('js-yaml');
const P = 'C:/Users/tanyu/.dsh/profiles/desktop/';
const m = JSON.parse(fs.readFileSync(P + 'package.json', 'utf8'));
const order = [];
for (const b of m.dsh.profile.bundles) {
  if (b.startsWith('@deepseek-ai/dsh-')) continue;
  const dir = P + 'node_modules/' + b;
  const pm = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
  const rel = pm.dsh?.bundle?.patch;
  if (!rel) continue;
  const y = yaml.load(fs.readFileSync(dir + '/' + rel.replace(/^\.\//, ''), 'utf8')) ?? [];
  order.push({ b, rows: y.flatMap((e) => (e.insert ?? []).map((i) => i.id)) });
}
const user = yaml.load(fs.readFileSync(P + 'cordis.patch.yml', 'utf8')) ?? [];
const userIns = user.flatMap((e) => (e.insert ?? []).map((i) => i.id));
console.log('bundle insert order:');
for (const o of order) console.log('  ', o.b.padEnd(32), o.rows.join(', '));
console.log('user patch inserts:', userIns.join(', '));
const seen = new Map();
for (const o of order) for (const r of o.rows) seen.set(r, o.b);
for (const r of userIns) seen.set(r, 'USER PATCH');
const dups = [...seen.keys()].filter((k) => {
  let n = 0;
  for (const o of order) n += o.rows.filter((x) => x === k).length;
  return n + userIns.filter((x) => x === k).length > 1;
});
console.log('\nduplicate ids:', dups.length ? dups.join(', ') : '(none)');
for (const d of dups) console.log(`  ${d}: 最后一层 = ${seen.get(d)}`);
