const r = await (await fetch('https://api.github.com/repos/zenglihunter/dsh-petdex-pet/contents/')).json();
if (Array.isArray(r)) {
  console.log('--- zenglihunter/dsh-petdex-pet ---');
  for (const e of r) console.log(`  ${e.type.padEnd(5)} ${String(e.size ?? '').padEnd(9)} ${e.name}`);
} else console.log(JSON.stringify(r).slice(0, 300));
const j = await (await fetch('https://registry.npmjs.org/petdex/latest')).json();
console.log('\n--- petdex latest ---');
console.log('version:', j.version, '| bin:', JSON.stringify(j.bin), '| desc:', j.description);
