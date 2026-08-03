// The client is the only place that decides what a failure *was*, and everything the
// analyst reads about one is phrased from that decision. The cases below are the ones the
// UI cannot reach on its own: a proxy standing in for a dead backend, a stalled request,
// and the upstream error pages that used to be rendered into the import banner verbatim.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiGet, describeApiError, errorDetail, TIMEOUT } from './client.js';
import { mockApi, fail, offline } from '../test/helpers/api.js';

afterEach(() => vi.unstubAllGlobals());

/** The single response both proxies emit when nothing is listening on :8080. */
const unreachable = () => fail(503, { error: 'backend_unreachable' });

const caught = async (fn) => {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  throw new Error('expected a rejection');
};

describe('request — failure classification', () => {
  it('names the backend when the proxy reports it is unreachable', async () => {
    mockApi({ 'GET /reconciliations': unreachable() });

    const err = await caught(() => apiGet('/reconciliations'));

    expect(err.kind).toBe('unreachable');
    expect(err.message).toContain('Is the backend running on :8080?');
    // Status 0, not the proxy's 503: nothing answered *for the backend*, and every caller
    // already reads 0 that way. ResetModal in particular says "could not be reached".
    expect(err.status).toBe(0);
  });

  it('classifies a fetch rejection the same way', async () => {
    mockApi({ 'GET /reconciliations': offline() });

    const err = await caught(() => apiGet('/reconciliations'));

    expect(err.kind).toBe('unreachable');
    expect(err.status).toBe(0);
  });

  it('leaves a 503 the backend itself returned as an ordinary server error', async () => {
    mockApi({ 'GET /reconciliations': fail(503, { message: 'maintenance' }) });

    const err = await caught(() => apiGet('/reconciliations'));

    expect(err.kind).toBe('http');
    expect(err.status).toBe(503);
  });

  it('reports a stalled request as a timeout rather than an unreachable backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
      }),
    );

    const err = await caught(() => apiGet('/reconciliations'));

    expect(err.kind).toBe('timeout');
    expect(err.message).toContain('did not respond in time');
    expect(err.status).toBe(0);
  });

  it('abandons a request that outlives its budget', async () => {
    // Nothing ever resolves, which is exactly the hang the timeouts exist for.
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_res, rej) => options.signal.addEventListener('abort', () => rej(options.signal.reason)))));

    const err = await caught(() => apiGet('/reconciliations', 20));

    expect(err.kind).toBe('timeout');
  });

  it('gives uploads and the run a longer budget than a read', () => {
    expect(TIMEOUT.read).toBeLessThan(TIMEOUT.upload);
    expect(TIMEOUT.upload).toBeLessThan(TIMEOUT.run);
  });
});

describe('errorDetail', () => {
  it('passes a short server message through', () => {
    expect(errorDetail({ body: 'bad csv' })).toBe('bad csv');
  });

  it('drops an upstream HTML error page', () => {
    // nginx's stock 502 body. It tells an analyst nothing and is longer than the banner.
    expect(errorDetail({ body: '<html>\n<head><title>502 Bad Gateway</title></head>\n</html>' })).toBe('');
  });

  it('caps a runaway body at 160 characters', () => {
    expect(errorDetail({ body: 'x'.repeat(400) })).toBe('x'.repeat(160));
  });

  it('has nothing to say about an empty or absent body', () => {
    expect(errorDetail({ body: '   ' })).toBe('');
    expect(errorDetail({})).toBe('');
    expect(errorDetail(null)).toBe('');
  });
});

describe('describeApiError', () => {
  it('names the action, the status and the server message', () => {
    expect(describeApiError({ kind: 'http', status: 415, body: 'bad csv' }, 'Ledger import')).toBe('Ledger import failed (415). bad csv');
  });

  it('lets an unreachable backend speak for itself, with no status or body appended', () => {
    const err = { kind: 'unreachable', status: 0, message: 'Could not reach the reconciliation service. Is the backend running on :8080?' };
    expect(describeApiError(err, 'Reconciliation')).toBe(err.message);
  });

  it('reports the status alone when the body was unusable', () => {
    expect(describeApiError({ kind: 'http', status: 502, body: '<html>502</html>' }, 'Settlement import')).toBe('Settlement import failed (502).');
  });

  it('falls back to the message when there is no body at all', () => {
    expect(describeApiError({ kind: 'http', status: 500, message: 'Malformed reconciliation payload.' }, 'Reconciliation')).toBe(
      'Reconciliation failed (500). Malformed reconciliation payload.',
    );
  });
});
