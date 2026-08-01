import { vi } from 'vitest';

// Every request in the app funnels through the single `fetch` in api/client.js, so one
// global stub covers reconciliations, both uploads, the run and all three deletes — with
// no module mocking, which means the real client normalisation (an Error carrying
// { status, body }, and the status-0 ":8080" message on a network throw) is still under
// test rather than stubbed past.

const JSON_HEADERS = {
  get: (k) => (String(k).toLowerCase() === 'content-type' ? 'application/json' : null),
};

const respond = (payload, status = 200, statusText = 'OK') => ({
  ok: status >= 200 && status < 300,
  status,
  statusText,
  headers: JSON_HEADERS,
  json: async () => payload,
  text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
});

/** Route result: a non-2xx response, driving client.js's `(status statusText)` message. */
export const fail = (status, body = { message: 'boom' }) => ({ __fail: true, status, body });

/** Route result: the fetch itself rejects — client.js's status-0 branch. */
export const offline = () => ({ __offline: true });

/**
 * @param {Record<string, unknown>} routes keyed `'METHOD /path'`, the path written without
 *   the /api/v1 prefix. A value may be a payload, `fail(...)`, `offline()`, or a function
 *   returning one of those.
 */
export function mockApi(routes = {}) {
  const table = { ...routes };
  const calls = [];
  const fetchMock = vi.fn(async (url, options = {}) => {
    const method = options.method || 'GET';
    const path = String(url).replace(/^\/api\/v1/, '');
    const key = `${method} ${path}`;
    calls.push({ key, method, path, url, options, body: options.body });
    const route = table[key];
    if (route === undefined) {
      // Loud rather than silent: an unstubbed call would otherwise read as an ordinary
      // server error and fail the test somewhere far from the cause.
      return respond({ message: `Unstubbed request: ${key}` }, 501, 'Not Implemented');
    }
    const result = typeof route === 'function' ? await route({ method, path, options, calls }) : route;
    if (result && result.__offline) throw new TypeError('Failed to fetch');
    if (result && result.__fail) return respond(result.body, result.status, 'Error');
    return respond(result ?? {});
  });
  const setRoute = (key, handler) => {
    table[key] = handler;
  };
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetch: fetchMock, setRoute, keys: () => calls.map((c) => c.key) };
}
