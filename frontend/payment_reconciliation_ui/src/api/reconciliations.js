// GET + POST /api/v1/reconciliations.

import { apiGet, apiPost } from './client.js';

/** Trigger reconciliation. Resolves to the number of new reconciled records. */
export function runReconciliation() {
  return apiPost('/reconciliations');
}

/** Fetch the three-map reconciliation payload (PRD §6.1). */
export function getReconciliations() {
  return apiGet('/reconciliations');
}
