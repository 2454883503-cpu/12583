import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const semver = require('semver');
const manifest = JSON.parse((await import('node:fs')).readFileSync('image-gen-repo/package.json', 'utf8'));
const runtime = '0.2.0-rc.2';
console.log('DSH runtime:', runtime);
console.log('--- DSH-enforced peer check (name must start with @deepseek-ai/dsh) ---');
const bad = [];
for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
  if (name !== '@deepseek-ai/dsh' && !name.startsWith('@deepseek-ai/dsh-')) continue;
  const ok = semver.satisfies(runtime, range, { includePrerelease: true });
  if (!ok) bad.push(`${name} ${range}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(42)} ${range}`);
}
console.log('denied peers:', bad.length ? bad.join(', ') : '(none) -> gate passes without an exemption');
console.log('--- declared dsh.compatibility (author metadata) ---');
console.log(JSON.stringify(manifest.dsh.compatibility));
