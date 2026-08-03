// Thin fetch wrapper. All calls are made to the relative API path so the Vite dev
// proxy (see vite.config.js) forwards them to the backend without CORS. Any non-2xx
// response is normalised into an Error carrying { kind, status, body } (PRD C5).

/**
 * The path prefix every endpoint sits under. Injected at build time by vite.config.js
 * from APP_API_PREFIX in the repo-root .env — the same value Spring maps its controllers
 * under and the nginx proxy matches. Exported so nothing else has to repeat the literal.
 */
export const API_PREFIX = __API_PREFIX__;

/**
 * How long a request may take before it is abandoned. Without these a backend that
 * accepts the connection and then stalls leaves the UI on its loading line forever.
 * The run budget matches nginx's `proxy_read_timeout 300s`, so the browser gives up at
 * the same moment the proxy does rather than before it.
 */
export const TIMEOUT = { read: 15_000, upload: 120_000, run: 300_000 };

const UNREACHABLE_MESSAGE = 'Could not reach the reconciliation service. Is the backend running on :8080?';
const TIMEOUT_MESSAGE = 'The reconciliation service did not respond in time.';

/** Longest error body shown to an analyst; the rest is noise on screen. */
const MAX_DETAIL = 160;

/**
 * `kind` says what class of failure this was, so callers can phrase it without
 * re-deriving it from a status code:
 *   'unreachable' — nothing answered for the backend (status 0)
 *   'timeout'     — it accepted the request and then stalled (status 0)
 *   'http'        — it answered, with a non-2xx (status is that code)
 */
function apiError(message, { kind, status = 0, body = '', cause } = {}) {
  const err = new Error(message);
  err.kind = kind;
  err.status = status;
  err.body = body;
  if (cause) err.cause = cause;
  return err;
}

/**
 * Both proxies in front of the backend answer a dead upstream with this exact body
 * rather than letting it read as a server error: see the `configure` hook in
 * vite.config.js and `@backend_down` in nginx.conf.template.
 */
function isUnreachableResponse(res, payload) {
  return res.status === 503 && !!payload && payload.error === 'backend_unreachable';
}

async function request(path, options = {}, timeoutMs = TIMEOUT.read) {
  let res;
  try {
    // Guarded: AbortSignal.timeout is unavailable in older runtimes, and a missing
    // timeout is worth degrading to rather than failing every request over.
    const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined;
    res = await fetch(API_PREFIX + path, signal ? { ...options, signal } : options);
  } catch (networkErr) {
    const name = networkErr && networkErr.name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw apiError(TIMEOUT_MESSAGE, { kind: 'timeout', cause: networkErr });
    }
    throw apiError(UNREACHABLE_MESSAGE, { kind: 'unreachable', cause: networkErr });
  }
  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '');
  if (!res.ok) {
    if (isUnreachableResponse(res, payload)) {
      // Deliberately status 0, not 503: the 503 belongs to the proxy, and every caller
      // already reads status 0 as "nothing answered" — which is exactly what happened.
      throw apiError(UNREACHABLE_MESSAGE, { kind: 'unreachable' });
    }
    throw apiError(`Request failed (${res.status} ${res.statusText}).`, {
      kind: 'http',
      status: res.status,
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
  }
  return payload;
}

export function apiGet(path, timeoutMs) {
  return request(path, { method: 'GET' }, timeoutMs);
}

export function apiPost(path, timeoutMs) {
  return request(path, { method: 'POST' }, timeoutMs);
}

export function apiDelete(path, timeoutMs) {
  return request(path, { method: 'DELETE' }, timeoutMs);
}

export function apiPutJson(path, body, timeoutMs = TIMEOUT.upload) {
  return request(
    path,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
}

export function apiPutForm(path, formData, timeoutMs = TIMEOUT.upload) {
  // NB: do not set Content-Type — the browser sets the multipart boundary.
  return request(path, { method: 'PUT', body: formData }, timeoutMs);
}

/**
 * The error body, trimmed to something safe to put on screen.
 *
 * A proxy between the browser and the backend answers with its own HTML error page, and
 * a stack trace from an unhandled server exception is no shorter. Neither tells an
 * analyst anything, and both used to be interpolated into the import banner verbatim.
 * Markup is dropped entirely; anything else is capped.
 */
export function errorDetail(err) {
  if (!err) return '';
  const text = String(typeof err.body === 'string' ? err.body : '').trim();
  if (!text || text.startsWith('<')) return '';
  return text.length > MAX_DETAIL ? text.slice(0, MAX_DETAIL) : text;
}

/**
 * One line describing a failed call, for the banner the action was triggered from.
 * @param {Error & {kind?: string, status?: number, body?: string}} err
 * @param {string} action e.g. 'Ledger import' → 'Ledger import failed (415). bad csv'
 */
export function describeApiError(err, action) {
  if (!err) return `${action} failed.`;
  // 'unreachable' and 'timeout' already carry a complete sentence naming the cause, and
  // have no status or body worth appending.
  if (err.kind === 'unreachable' || err.kind === 'timeout') return err.message;
  const detail = errorDetail(err) || (err.body ? '' : String(err.message || '').trim());
  return `${action} failed${err.status ? ` (${err.status})` : ''}.${detail ? ` ${detail}` : ''}`;
}

/** Summarise an { key: 'INSERTED_OR_UPDATED' | 'NO_CHANGE' } response map. */
export function summarizeStatuses(map) {
  const entries = Object.entries(map || {});
  let changed = 0;
  let unchanged = 0;
  for (const [, v] of entries) {
    if (v === 'NO_CHANGE') unchanged += 1;
    else changed += 1;
  }
  return { total: entries.length, changed, unchanged, entries };
}
