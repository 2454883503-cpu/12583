const tags = await (await fetch('https://api.github.com/repos/LeemanCheung/dsh-image-gen/tags')).json();
console.log('--- tags ---');
console.log(tags.map((t) => `${t.name} ${t.commit?.sha?.slice(0, 8)}`).join('\n') || '(none)');
const rel = await (await fetch('https://api.github.com/repos/LeemanCheung/dsh-image-gen/releases')).json();
console.log('--- releases ---');
console.log(rel.map((r) => `${r.tag_name} ${r.name} ${r.published_at}`).join('\n') || '(none)');
const commits = await (await fetch('https://api.github.com/repos/LeemanCheung/dsh-image-gen/commits?per_page=8')).json();
console.log('--- recent commits ---');
console.log(commits.map((c) => `${c.sha.slice(0, 8)} ${c.commit.author.date} ${c.commit.message.split('\n')[0]}`).join('\n'));
