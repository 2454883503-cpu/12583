const j = await (await fetch('https://api.github.com/repos/Ebony-Vinyl/EAC-skin-loader/contents/docs/git-distribution.md')).json();
const t = Buffer.from(j.content, 'base64').toString('utf8');
console.log(t.slice(0, 4000));
