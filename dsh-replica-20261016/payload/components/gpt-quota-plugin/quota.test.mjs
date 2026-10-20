import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuotaReader, defaultProxyURL } from './quota.mjs';

test('requires an explicit credential path', () => {
  assert.throws(() => createQuotaReader(), /authPath is required/);
});

test('proxy URL is overridable so the plugin survives a machine move', () => {
  const previous = process.env.DSH_LOCAL_PROXY;
  try {
    delete process.env.DSH_LOCAL_PROXY;
    assert.equal(defaultProxyURL(), 'http://127.0.0.1:7892');
    process.env.DSH_LOCAL_PROXY = 'http://127.0.0.1:10809';
    assert.equal(defaultProxyURL(), 'http://127.0.0.1:10809');
    process.env.DSH_LOCAL_PROXY = '   ';
    assert.equal(defaultProxyURL(), 'http://127.0.0.1:7892');
  } finally {
    if (previous === undefined) delete process.env.DSH_LOCAL_PROXY;
    else process.env.DSH_LOCAL_PROXY = previous;
  }
});

test('missing credentials return sanitized unavailable state, not fabricated quotas', async () => {
  const read = createQuotaReader({ authPath: 'Z:/nonexistent-quota-test/auth.json' });
  const [first, concurrent] = await Promise.all([read(), read()]);
  assert.deepEqual(first, {
    windows: { fiveHour: null, week: null }, fetchedAt: null,
    stale: true, error: 'Codex credentials unavailable.',
  });
  assert.deepEqual(concurrent, first);
  first.windows.fiveHour = { usedPercent: 99 };
  const forced = await read({ force: true });
  assert.equal(forced.windows.fiveHour, null, 'callers cannot mutate cached state');
  assert.equal(JSON.stringify(forced).includes('Z:/'), false);
});
