const repos = ['zenglihunter/dsh-petdex-pet', 'crafter-station/petdex'];
for (const repo of repos) {
  console.log(`\n===== ${repo} =====`);
  const r = await (await fetch(`https://api.github.com/repos/${repo}/contents/pets`)).json();
  if (Array.isArray(r)) {
    console.log('pets/:');
    for (const e of r) console.log(`  ${e.type.padEnd(5)} ${String(e.size ?? '').padEnd(8)} ${e.name}`);
  } else console.log('no pets/ dir:', JSON.stringify(r).slice(0,150));
}
