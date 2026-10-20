import fs from 'node:fs';
const api = 'https://api.github.com/repos/LeemanCheung/dsh-image-gen/contents/package.json?ref=';
const head = JSON.parse(fs.readFileSync('image-gen-repo/package.json', 'utf8'));
const tagRes = await fetch(api + 'v0.4.1');
const tag = JSON.parse(Buffer.from((await tagRes.json()).content, 'base64').toString('utf8'));
fs.writeFileSync('image-gen-repo/package.v0.4.1.json', JSON.stringify(tag, null, 2));
const show = (label, m) => {
  console.log(`--- ${label} (version ${m.version}) ---`);
  console.log('dsh.compatibility.dsh:', m.dsh?.compatibility?.dsh);
  const dshDev = Object.entries(m.devDependencies ?? {}).filter(([n]) => n.startsWith('@deepseek-ai/')).map(([n, v]) => `${n.replace('@deepseek-ai/', '')}@${v}`);
  console.log('devDeps dsh-*:', dshDev.join(' '));
  const peers = Object.entries(m.peerDependencies ?? {}).filter(([n]) => n.startsWith('@deepseek-ai/dsh-'));
  console.log('peer dsh-* count:', peers.length, '| distinct ranges:', [...new Set(peers.map(([, v]) => v))].join(' '));
};
show('TAG v0.4.1', tag);
show('HEAD main', head);
const differing = Object.keys({ ...tag.peerDependencies, ...head.peerDependencies }).filter((k) => tag.peerDependencies?.[k] !== head.peerDependencies?.[k]);
console.log('peer ranges differing between tag and head:', differing.length ? differing.join(', ') : '(none)');
