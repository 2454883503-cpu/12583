// Extract selected files from DSH's app.asar by reading its index header.
const fs = require('fs');
const path = require('path');

const asar = 'D:/AA12583/dsh/resources/app.asar';
const outDir = process.argv[2];
const wanted = process.argv.slice(3);

const fd = fs.openSync(asar, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const headerSize = head.readUInt32LE(12);
const header = Buffer.alloc(headerSize);
fs.readSync(fd, header, 0, headerSize, 16);
const tree = JSON.parse(header.toString());
const base = 8 + head.readUInt32LE(4);

const files = new Map();
(function walk(node, prefix) {
  for (const [name, entry] of Object.entries(node.files || {})) {
    const p = prefix ? `${prefix}/${name}` : name;
    if (entry.files) walk(entry, p);
    else files.set(p, entry);
  }
})(tree, '');

let ok = 0;
for (const want of wanted) {
  const entry = files.get(want);
  if (!entry) { console.log(`MISSING ${want}`); continue; }
  const buf = Buffer.alloc(entry.size);
  fs.readSync(fd, buf, 0, entry.size, base + Number(entry.offset));
  const dest = path.join(outDir, want.replace(/^dsh\//, '').replace(/@/g, '_at_'));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  console.log(`OK ${want} (${entry.size}) -> ${dest}`);
  ok++;
}
fs.closeSync(fd);
console.log(`extracted ${ok}/${wanted.length}; index has ${files.size} files`);
