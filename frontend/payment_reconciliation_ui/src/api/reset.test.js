// FR-9.3: the deletes go out in dependency order, and a failure halts the sequence
// rather than pressing on. Both are things the live happy path cannot demonstrate, so
// they are pinned here against a stubbed fetch.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { runReset, RESET_STEPS } from './reset.js';

const JSON_HEADERS = { get: () => 'application/json' };

/** Stub global.fetch, failing the call whose path contains `failOn`. Records calls. */
function stubFetch({ failOn = null, status = 500 } = {}) {
  const calls = [];
  global.fetch = vi.fn(async (url, options) => {
    calls.push({ url, method: options.method });
    if (failOn && url.includes(failOn)) {
      return { ok: false, status, statusText: 'Server Error', headers: JSON_HEADERS, json: async () => ({ message: 'boom' }) };
    }
    return { ok: true, status: 200, headers: JSON_HEADERS, json: async () => ({ record_count: 7 }) };
  });
  return calls;
}

afterEach(() => {
  delete global.fetch;
});

describe('runReset — dependency order (FR-9.3)', () => {
  it('deletes reconciliations, then ledger, then settlements', async () => {
    const calls = stubFetch();
    const res = await runReset();

    expect(res.failedAt).toBeNull();
    expect(res.error).toBeNull();
    expect(res.done).toEqual(['recon', 'ledger', 'settle']);
    // Reconciliations must go first: the source rows they reference outlive them.
    expect(calls.map((c) => c.url)).toEqual([
      '/api/v1/reconciliations',
      '/api/v1/ledger-transactions',
      '/api/v1/processor-settlement-transactions',
    ]);
    expect(calls.every((c) => c.method === 'DELETE')).toBe(true);
  });

  it('reports every step through onStep, in order', async () => {
    stubFetch();
    const seen = [];
    await runReset((key) => seen.push(key));
    expect(seen).toEqual(RESET_STEPS.map((s) => s.key));
  });
});

describe('runReset — halt on failure (FR-9.3)', () => {
  it('stops at the failing step and never attempts the one after it', async () => {
    const calls = stubFetch({ failOn: '/ledger-transactions' });
    const res = await runReset();

    expect(res.done).toEqual(['recon']);
    expect(res.failedAt).toBe('ledger');
    expect(res.error).toBeInstanceOf(Error);
    expect(res.error.status).toBe(500);
    // "nothing after the failure was attempted" — what the dialog tells the analyst.
    expect(calls.map((c) => c.url)).not.toContain('/api/v1/processor-settlement-transactions');
    expect(calls).toHaveLength(2);
  });

  it('reports nothing cleared when the very first delete fails', async () => {
    const calls = stubFetch({ failOn: '/reconciliations' });
    const res = await runReset();

    expect(res.done).toEqual([]);
    expect(res.failedAt).toBe('recon');
    expect(calls).toHaveLength(1);
  });

  it('surfaces a network failure the same way as a non-2xx', async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const res = await runReset();

    expect(res.done).toEqual([]);
    expect(res.failedAt).toBe('recon');
    expect(res.error.status).toBe(0);
  });
});
