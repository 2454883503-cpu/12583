import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const semver = require('semver');
const runtime = '0.2.0-rc.2';
const peers = { '@deepseek-ai/dsh': '>=0.1.1-rc.2' };
for (const [n, r] of Object.entries(peers)) {
  const enforced = n === '@deepseek-ai/dsh' || n.startsWith('@deepseek-ai/dsh-');
  const ok = semver.satisfies(runtime, r, { includePrerelease: true });
  console.log(`${enforced ? 'ENFORCED' : 'skipped '} ${ok ? 'PASS' : 'FAIL'}  ${n} ${r}  (runtime ${runtime})`);
}
