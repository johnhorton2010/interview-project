// Thin fetch wrapper. All calls are made to the relative /api path so the Vite dev
// proxy (see vite.config.js) forwards them to the backend without CORS. Any non-2xx
// response is normalised into an Error carrying { status, body } (PRD C5).

const PREFIX = '/api/v1';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(PREFIX + path, options);
  } catch (networkErr) {
    const err = new Error('Could not reach the reconciliation service. Is the backend running on :8080?');
    err.cause = networkErr;
    err.status = 0;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '');
  if (!res.ok) {
    const err = new Error(`Request failed (${res.status} ${res.statusText}).`);
    err.status = res.status;
    err.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    throw err;
  }
  return payload;
}

export function apiGet(path) {
  return request(path, { method: 'GET' });
}

export function apiPost(path) {
  return request(path, { method: 'POST' });
}

export function apiDelete(path) {
  return request(path, { method: 'DELETE' });
}

export function apiPutJson(path, body) {
  return request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function apiPutForm(path, formData) {
  // NB: do not set Content-Type — the browser sets the multipart boundary.
  return request(path, { method: 'PUT', body: formData });
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
