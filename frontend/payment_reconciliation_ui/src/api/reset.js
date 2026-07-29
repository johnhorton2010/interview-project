// FR-9 reset flow. The three DELETE endpoints are planned but not yet implemented
// server-side (PRD C4/D7), so these calls will currently fail — the reset dialog is
// wired end-to-end and reports each dataset's real outcome the moment they land.

import { apiDelete } from './client.js';

export const RESET_STEPS = [
  { key: 'recon', endpoint: 'DELETE /api/v1/reconciliations', path: '/reconciliations' },
  { key: 'ledger', endpoint: 'DELETE /api/v1/ledger-transactions', path: '/ledger-transactions' },
  { key: 'settle', endpoint: 'DELETE /api/v1/processor-settlement-transactions', path: '/processor-settlement-transactions' },
];

/**
 * Delete reconciliations, then the two source datasets, in dependency order.
 * Halts on the first failure (FR-9.3).
 * @param {(key: string) => void} onStep  called as each step begins
 * @returns {Promise<{ done: string[], failedAt: string|null, error: Error|null }>}
 */
export async function runReset(onStep) {
  const done = [];
  for (const step of RESET_STEPS) {
    onStep?.(step.key);
    try {
      await apiDelete(step.path);
      done.push(step.key);
    } catch (error) {
      return { done, failedAt: step.key, error };
    }
  }
  return { done, failedAt: null, error: null };
}
