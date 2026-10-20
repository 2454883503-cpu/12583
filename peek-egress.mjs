const j = await (await fetch('https://api.github.com/repos/Ebony-Vinyl/dsh-our-free-model/contents/src/egress.js')).json();
const t = Buffer.from(j.content, 'base64').toString('utf8');
console.log(t.slice(0, 3000));
