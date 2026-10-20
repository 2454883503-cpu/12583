const regs = ['https://registry.npmjs.org', 'https://registry.npmmirror.com'];
for (const r of regs) {
  try {
    const j = await (await fetch(`${r}/dsh-image-gen`, { signal: AbortSignal.timeout(20000) })).json();
    const vs = Object.keys(j.versions ?? {});
    const last = vs.slice(-4);
    console.log(`${r.padEnd(32)} latest=${j['dist-tags']?.latest}  versions=${vs.length}  last: ${last.join(', ')}`);
    for (const v of ['0.9.0', '0.9.1']) {
      const t = j.time?.[v];
      if (t) console.log(`    ${v} published ${t}`);
    }
  } catch (e) { console.log(`${r.padEnd(32)} FAIL ${e.cause?.code ?? e.name}`); }
}
