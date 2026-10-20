// Tests for gpt-bridge-autostart: pure config logic plus a real spawn against
// the bridge binary on a throwaway port, driven through a mock Cordis context.
//
// Run directly:  node gpt-bridge-autostart/index.test.mjs
// (do not use `node --test`: multi-process test runners are blocked in some
// sandboxes with spawn EPERM)

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolveSettings, isPortUp, diagnose, spawnSpec } from './lib.mjs';
import { apply } from './index.mjs';

test('resolveSettings falls back to source-machine defaults', () => {
  const s = resolveSettings({}, {});
  assert.equal(s.port, 18080);
  assert.equal(s.proxyURL, 'http://127.0.0.1:7892');
  assert.match(s.execPath, /openai-api-server-via-codex\.exe$/);
  assert.match(s.authPath, /\.codex-chatgpt[\\/]auth\.json$/);
  assert.equal(s.graceMs, 10000);
});

test('resolveSettings honours config and environment overrides', () => {
  const s = resolveSettings(
    { port: 18099, bridgeDir: 'E:\\bridge', proxyURL: 'http://127.0.0.1:7890', graceMs: 0 },
    {},
  );
  assert.equal(s.port, 18099);
  assert.equal(s.bridgeDir, 'E:\\bridge');
  assert.equal(s.proxyURL, 'http://127.0.0.1:7890');
  assert.equal(s.graceMs, 0);

  const env = resolveSettings({ proxyURL: '   ' }, { DSH_LOCAL_PROXY: 'http://127.0.0.1:10809' });
  assert.equal(env.proxyURL, 'http://127.0.0.1:10809');

  const bad = resolveSettings({ port: 99999 }, {});
  assert.equal(bad.port, 18080, 'out-of-range port falls back instead of breaking the spawn');
});

test('isPortUp reports false on a closed port and true on a listening one', async () => {
  assert.equal(await isPortUp(1), false, 'port 1 should be closed');
  const { createServer } = await import('node:net');
  const server = createServer((socket) => socket.end());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    assert.equal(await isPortUp(port), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('diagnose lists missing files and passes when both exist', () => {
  const broken = diagnose({ execPath: 'Z:\\nope\\x.exe', authPath: 'Z:\\nope\\auth.json' });
  assert.equal(broken.length, 2);
  const settings = resolveSettings({}, {});
  assert.deepEqual(diagnose(settings), []);
});

test('spawnSpec pins stdio, proxy env and argv explicitly', () => {
  const s = resolveSettings({}, {});
  const spec = spawnSpec(s);
  assert.equal(spec.stdin, undefined, 'stdin belongs under stdio');
  assert.equal(spec.stdio.stdin, 'ignore');
  assert.equal(spec.env.HTTPS_PROXY, s.proxyURL);
  assert.equal(spec.env.NO_PROXY, 'localhost,127.0.0.1');
  assert.deepEqual(spec.argv.slice(1, 4), ['-auth-json', s.authPath, '-port']);
  assert.equal(spec.argv[4], String(s.port));
  assert.equal(spec.cwd, s.bridgeDir);
});

test('apply() spawns the bridge, serves HTTP, and terminates on dispose', async () => {
  const PORT = 18097;
  const messages = [];
  const log = {
    info: (m) => messages.push(`info ${m}`),
    warn: (m) => messages.push(`warn ${m}`),
    error: (m) => messages.push(`error ${m}`),
  };

  const handles = [];
  let disposer;
  const ctx = {
    logger: log,
    // The plugin reads config from the fiber (ctx.config is an inject-gated
    // service accessor in Cordis), and takes the service directly because the
    // module declares inject: ['subprocess'].
    fiber: { _config: { port: PORT } },
    subprocess: {
      spawn(spec) {
        // Mirror the real spec: stdin ignored, and no piped stdio (some sandboxes
        // reject piped child stdio with EPERM, which is not a plugin defect).
        const child = spawn(spec.argv[0], spec.argv.slice(1), {
          cwd: spec.cwd,
          stdio: ['ignore', 'ignore', 'ignore'],
          windowsHide: true,
          env: { ...process.env, ...spec.env },
        });
        const handle = {
          exitCode: undefined,
          collected: { stderr: { readFrom: () => Buffer.alloc(0) } },
          done: new Promise((resolve) => child.on('exit', (code, signal) => resolve({ exitCode: code, signal }))),
          terminate() { try { child.kill(); } catch { } },
        };
        child.on('exit', () => { handle.exitCode = child.exitCode ?? -1; });
        handles.push(handle);
        return handle;
      },
    },
    effect(fn, label) {
      assert.equal(label, 'gpt-bridge-autostart');
      disposer = fn();
    },
  };

  apply(ctx);
  assert.ok(disposer, 'apply must register a disposer through ctx.effect');

  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    await new Promise((r) => setTimeout(r, 250));
    up = await isPortUp(PORT);
  }
  assert.equal(up, true, `bridge should listen on ${PORT}; log: ${messages.join(' | ')}`);

  const response = await fetch(`http://127.0.0.1:${PORT}/v1/models`, { headers: { Authorization: 'Bearer dummy' } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body.data) && body.data.length > 0, 'bridge must return a model list');

  await disposer();
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(await isPortUp(PORT), false, 'dispose must terminate the bridge');
}, { timeout: 120000 });
