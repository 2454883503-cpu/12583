import fs from 'node:fs';
const repo = 'xpy12367/codex-pet-DeepSeek-girl';
const api = `https://api.github.com/repos/${repo}/contents/`;
for (const f of ['spritesheet.webp', 'pet.json']) {
  const j = await (await fetch(api + f)).json();
  const b = Buffer.from(j.content, 'base64');
  fs.mkdirSync('girl-pet-src', { recursive: true });
  fs.writeFileSync('girl-pet-src/' + f, b);
  console.log('OK', f, b.length, 'bytes');
}
