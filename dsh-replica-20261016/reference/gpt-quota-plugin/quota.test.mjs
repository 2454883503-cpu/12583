import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuotaReader } from './quota.mjs';

test('requires an explicit credential path', () => {
  assert.throws(() => createQuotaReader(), /authPath is required/);
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
