const t = ['https://registry.npmjs.org/petdex', 'https://registry.npmjs.org/@petdex%2Fcli', 'https://api.github.com/search/repositories?q=petdex+dsh'];
for (const u of t) {
  const s = Date.now();
  try { const r = await fetch(u, { signal: AbortSignal.timeout(12000) }); const txt = (await r.text()).slice(0,300).replace(/\s+/g,' ');
    console.log(`OK ${String(r.status).padEnd(4)} ${Date.now()-s}ms ${u}`); console.log('     ' + txt.slice(0,240)); }
  catch (e) { console.log(`FAIL ${String(e.cause?.code ?? e.name).padEnd(12)} ${u}`); }
}
