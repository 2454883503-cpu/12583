const files = ['src/providers/registry.json', 'src/trust.js'];
for (const f of files) {
  const j = await (await fetch('https://api.github.com/repos/Ebony-Vinyl/dsh-our-free-model/contents/' + f)).json();
  const t = Buffer.from(j.content, 'base64').toString('utf8');
  console.log(`\n===== ${f} (${t.length} bytes) =====`);
  console.log(t.slice(0, 2500));
}
