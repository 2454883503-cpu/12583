import fs from 'node:fs';
const meta = await (await fetch('https://registry.npmjs.org/dsh-session-sync')).json();
fs.writeFileSync('session-sync-readme.md', meta.readme ?? '(no readme)');
const t = await fetch('https://registry.npmjs.org/dsh-session-sync/-/dsh-session-sync-0.2.24.tgz');
const b = Buffer.from(await t.arrayBuffer());
fs.writeFileSync('dsh-session-sync-0.2.24.tgz', b);
console.log('readme bytes', (meta.readme ?? '').length, 'tarball bytes', b.length);
