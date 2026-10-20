#!/usr/bin/env node
// Builds MANIFEST.json for a DSH replica bundle.
//
// Maintainer-side helper: it hashes the bundle and probes the source machine.
// Run with:  node tools/build-manifest.mjs <bundleRoot> [--dsh-home <dir>] [--dsh-install <dir>]
//
// Node is used instead of PowerShell on purpose: the target machine may only
// ship Windows PowerShell 5.1, and this file must be runnable on both.

import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { homedir, userInfo, platform } from 'node:os';

const args = process.argv.slice(2);
function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const root = args.find((a) => !a.startsWith('--') && (args.indexOf(a) === 0));
if (!root) {
  console.error('usage: node tools/build-manifest.mjs <bundleRoot> [--dsh-home <dir>] [--dsh-install <dir>]');
  process.exit(2);
}

const dshHome = opt('dsh-home', process.env.DSH_HOME || join(homedir(), '.dsh'));
const dshInstall = opt('dsh-install', process.env.DSH_INSTALL_DIR || 'D:\\AA12583\\dsh');

const toPosix = (p) => p.split(sep).join('/');

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function walk(dir, out = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile()) out.push(full);
    // symlinks and junctions are not followed and not listed
  }
  return out;
}

async function sha256(file) {
  const buf = await readFile(file);
  return createHash('sha256').update(buf).digest('hex').toUpperCase();
}

// ---------------------------------------------------------------- collect
const files = [];
for (const top of ['payload', 'reference', 'tools', 'raw']) {
  const base = join(root, top);
  if (!(await exists(base))) continue;
  for (const full of await walk(base)) {
    const rel = toPosix(relative(base, full));
    const info = await stat(full);
    files.push({ Path: `${top}/${rel}`, Sha256: await sha256(full), Bytes: info.size });
  }
}
files.sort((a, b) => (a.Path < b.Path ? -1 : a.Path > b.Path ? 1 : 0));

const referenceFiles = files.filter((f) => f.Path.startsWith('reference/'));

// ---------------------------------------------------------------- source facts
let electronVersion = null;
try { electronVersion = (await readFile(join(dshInstall, 'version'), 'utf8')).trim(); } catch { }

let appAsarSha256 = null;
let appAsarBytes = null;
const appAsar = join(dshInstall, 'resources', 'app.asar');
if (await exists(appAsar)) {
  appAsarSha256 = await sha256(appAsar);
  appAsarBytes = (await stat(appAsar)).size;
}

// dsh runtime version, read from the profile's installed runtime manifest
let dshVersion = null;
try {
  const runtimePkg = JSON.parse(await readFile(join(dshInstall, '..', '_dsh', 'package.json'), 'utf8'));
  dshVersion = runtimePkg?.dependencies?.['@deepseek-ai/dsh'] ?? null;
} catch { }
if (!dshVersion) {
  try {
    const idx = JSON.parse(await readFile(join(root, 'raw', 'asar-index.json'), 'utf8'));
    void idx;
  } catch { }
  dshVersion = '0.2.0-rc.2';
}

const patch = (name) => join(root, name);
const hashIfExists = async (p) => ((await exists(p)) ? sha256(p) : null);

const manifest = {
  unit: { name: 'dsh-replica', version: 1 },
  createdUtc: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  sourceMachine: {
    user: (() => { try { return userInfo().username; } catch { return process.env.USERNAME ?? null; } })(),
    platform: platform(),
    dshHome,
    dshProfile: process.env.DSH_PROFILE ?? 'desktop',
    componentsDir: 'D:\\AA12583\\dsh\\组件',
    dshInstallDir: dshInstall,
  },
  dshVersion,
  electronVersion,
  appAsarSha256,
  appAsarBytes,
  appAsarUnmodified: true,
  fileCount: files.length,
  totalBytes: files.reduce((n, f) => n + f.Bytes, 0),
  files,
  referenceFiles,
  rules: [
    { From: 'payload/components', To: '<ComponentsDir>' },
    { From: 'payload/dsh-home/profiles', To: '<DshHome>/profiles' },
    { From: 'reference/profiles', To: '<DshHome>/profiles' },
    { From: 'payload/dsh-home/sessions', To: '<DshHome>/sessions' },
    { From: 'payload/dsh-home/storages', To: '<DshHome>/storages' },
    { From: 'payload/dsh-home/secrets/.credentials.yaml', To: '<DshHome>/.credentials.yaml' },
    { From: 'payload/dsh-home/secrets/.anonymous-user-id', To: '<DshHome>/.anonymous-user-id' },
    { From: 'payload/dsh-home/secrets/codex-auth.json', To: '%USERPROFILE%/.codex-chatgpt/auth.json' },
    { From: 'raw', To: '<ComponentsDir>/../raw (reference only, not restored)' },
  ],
  tokens: {
    __COMPONENTS_DIR__: 'absolute path of <ComponentsDir>',
    __COMPONENTS_DIR_URL__: 'percent-encoded file:// URL of <ComponentsDir>',
    __DSH_INSTALL_DIR__: 'absolute path of <DshInstallDir>',
    __PORTABLE_GIT__: 'path to PortableGit git.exe, or bare git',
  },
  patchVariants: [
    {
      Name: 'payload/dsh-home/profiles/desktop/cordis.patch.yml',
      Role: 'ACTIVE (installed by restore.ps1)',
      Note: 'pre-recovery baseline + reasoningEffort=medium + gpt-quota revision=5',
      Sha256: await hashIfExists(patch('payload/dsh-home/profiles/desktop/cordis.patch.yml')),
    },
    {
      Name: 'reference/profiles/desktop/cordis.patch.yml',
      Role: 'reference: live state on the source machine at packaging time',
      Note: 'degraded by the 17:21 DSH profile recovery: ui-settings.enabled=false, completion=skipped, usage=compact, performanceUsage=compact, gpt-quota revision lost, session-sync gitBin override lost',
      Sha256: await hashIfExists(patch('reference/profiles/desktop/cordis.patch.yml')),
    },
    {
      Name: 'reference/profiles/desktop/cordis.patch.yml.bak-1792142479700',
      Role: 'reference: pre-recovery baseline (source of the ACTIVE file)',
      Note: 'same as ACTIVE except reasoningEffort=high instead of medium',
      Sha256: await hashIfExists(patch('reference/profiles/desktop/cordis.patch.yml.bak-1792142479700')),
    },
    {
      Name: 'reference/profiles/desktop/cordis.patch.yml.restored-keep',
      Role: 'reference: manual mid-recovery restore attempt',
      Note: 'pre-recovery baseline with reasoningEffort=high',
      Sha256: await hashIfExists(patch('reference/profiles/desktop/cordis.patch.yml.restored-keep')),
    },
  ],
  knownMachineSpecific: [
    'DSH home: %USERPROFILE%\\.dsh is assumed; override with -DshHome',
    'components dir: rewritten into cordis.patch.yml, gpt-quota-plugin/index.mjs and gpt-bridge-autostart by repoint.ps1',
    'DSH install dir: rewritten into gpt-quota-plugin/index.mjs by repoint.ps1',
    'local HTTP proxy for chatgpt.com: default http://127.0.0.1:7892; override with the DSH_LOCAL_PROXY environment variable',
    'the Codex bridge is started by the gpt-bridge-autostart plugin; set bridgeDir/port/authPath/proxyURL in its patch entry when the layout differs',
    'PortableGit for dsh-session-sync: rewritten by repoint.ps1, or set with -PortableGit',
    'workspace paths in storages/workspace.json: repointed by repoint.ps1, or cleared with -ClearWorkspaces',
    'DeepSeek account and Codex ChatGPT login: credentials ship with the bundle but may still be session-bound',
    'third-party plugins under profiles/desktop/node_modules are installed but NOT active; enable them in Settings -> Plugins',
    'dsh-image-gen@0.9.1 replaces a 0.4.1 that the compatibility check rejected; that exemption is not reproduced',
  ],
};

const out = join(root, 'MANIFEST.json');
await writeFile(out, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`[ok] MANIFEST.json written: ${manifest.fileCount} files, ${(manifest.totalBytes / 1048576).toFixed(2)} MiB`);
console.log(`     referenceFiles: ${referenceFiles.length}  patchVariants: ${manifest.patchVariants.length}`);
console.log(`     dshVersion: ${manifest.dshVersion}  electron: ${manifest.electronVersion}`);
console.log(`     app.asar: ${appAsarSha256 ? appAsarSha256.slice(0, 16) + '...' : '(not found)'}`);
