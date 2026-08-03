// GET + POST <API_PREFIX>/reconciliations.

import { apiGet, apiPost, TIMEOUT } from './client.js';

/** Trigger reconciliation. Resolves to the number of new reconciled records. */
export async function runReconciliation() {
  // Matching over a large import is the one call that can legitimately run for minutes,
  // so it gets the long budget rather than the default read timeout.
  const res = await apiPost('/reconciliations', TIMEOUT.run);
  // The endpoint used to return a bare integer; it now returns a { record_count } object.
  if (typeof res === 'number') return res;
  return (res && res.record_count) ?? 0;
}

/** Fetch the three-map reconciliation payload (PRD §6.1). */
export function getReconciliations() {
  return apiGet('/reconciliations');
}
