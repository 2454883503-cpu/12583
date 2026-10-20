import { createRequire } from 'node:module';
const require = createRequire('file:///C:/Users/tanyu/dsh/');
const semver = require('semver');
const runtime = '0.2.0-rc.2';
const cases = [
  ['@deepseek-ai/dsh', '0.1.7-rc.2 || 0.2.0-rc.2'],
  ['@deepseek-ai/cordis', '~4.0.4'],
  ['@deepseek-ai/schemastery', '~3.18.4']
];
for (const [n, r] of cases) {
  const enforced = n === '@deepseek-ai/dsh' || n.startsWith('@deepseek-ai/dsh-');
  const ok = semver.satisfies(runtime, r, { includePrerelease: true });
  console.log(`${enforced ? 'ENFORCED' : 'not-enforced'}  ${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(30)} ${r}`);
}
console.log('\ncordis installed: 4.0.4 -> ~4.0.4 =', semver.satisfies('4.0.4', '~4.0.4'));
console.log('schemastery installed: 3.18.4 -> ~3.18.4 =', semver.satisfies('3.18.4', '~3.18.4'));
