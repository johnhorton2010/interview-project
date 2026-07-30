// GET + POST /api/v1/reconciliations.

import { apiGet, apiPost } from './client.js';

/** Trigger reconciliation. Resolves to the number of new reconciled records. */
export async function runReconciliation() {
  const res = await apiPost('/reconciliations');
  // The endpoint used to return a bare integer; it now returns a { record_count } object.
  if (typeof res === 'number') return res;
  return (res && res.record_count) ?? 0;
}

/** Fetch the three-map reconciliation payload (PRD §6.1). */
export function getReconciliations() {
  return apiGet('/reconciliations');
}
