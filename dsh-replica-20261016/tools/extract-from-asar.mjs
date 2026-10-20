#!/usr/bin/env node
// Extract individual files (or list entries) from Electron's app.asar.
//
// app.asar layout:
//   0..3   uint32le  reserved / unused
//   4..7   uint32le  payload base offset contribution
//   8..11  uint32le  header JSON size (string bytes)
//   12..15 uint32le  header size (also includes the 8-byte preamble)
//   16..   header JSON; file payloads start at 8 + headerSize
//
// Usage:
//   node extract-from-asar.mjs <app.asar> --list <regex>
//   node extract-from-asar.mjs <app.asar> <asar/internal/path> <dest> [more paths...]
//   node extract-from-asar.mjs <app.asar> <internal/path> <destDir>     # ends with /, path keeps its basename

import { open, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';

const args = process.argv.slice(2);
const asarPath = args.shift();
if (!asarPath) {
  console.error('usage: node extract-from-asar.mjs <app.asar> --list <regex> | <internalPath> <dest>...');
  process.exit(2);
}

const handle = await open(asarPath, 'r');
try {
  const head = Buffer.alloc(16);
  await handle.read(head, 0, 16, 0);
  const headerSize = head.readUInt32LE(12);
  const header = Buffer.alloc(headerSize);
  await handle.read(header, 0, headerSize, 16);
  const tree = JSON.parse(header.toString());
  const base = 8 + head.readUInt32LE(4);

  const files = new Map();
  (function walk(node, prefix) {
    for (const [name, entry] of Object.entries(node.files ?? {})) {
      const full = prefix ? `${prefix}/${name}` : name;
      if (entry.files) walk(entry, full);
      else files.set(full, entry);
    }
  })(tree, '');

  if (args[0] === '--list') {
    const re = new RegExp(args[1] ?? '.', 'i');
    const hits = [...files.entries()].filter(([p]) => re.test(p)).sort(([a], [b]) => (a < b ? -1 : 1));
    for (const [p, e] of hits) console.log(`${e.unpacked ? '[unpacked] ' : ''}${e.size}\t${p}`);
    console.log(`\n${hits.length} entries match ${re} (index has ${files.size} files)`);
    process.exit(0);
  }

  let ok = 0;
  for (let i = 0; i + 1 < args.length; i += 2) {
    const want = args[i];
    let dest = args[i + 1];
    const entry = files.get(want);
    if (!entry) { console.error(`MISSING ${want}`); continue; }
    if (entry.unpacked) { console.error(`UNPACKED ${want} (read from app.asar.unpacked)`); continue; }
    if (dest.endsWith('/') || dest.endsWith('\\')) dest = join(dest, basename(want));
    const buf = Buffer.alloc(entry.size);
    if (entry.size > 0) await handle.read(buf, 0, entry.size, base + Number(entry.offset));
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    console.log(`OK ${want} (${entry.size}) -> ${dest}`);
    ok++;
  }
  console.log(`extracted ${ok}`);
} finally {
  await handle.close();
}
