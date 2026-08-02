// FR-9 reset flow. All three DELETE endpoints are live; each returns { record_count }.
// The bodies are ignored here — FR-9.3 asks only which datasets were and were not
// cleared, which the step outcome below already carries.

import { API_PREFIX, apiDelete } from './client.js';

// `path` is prefix-less — client.js prepends API_PREFIX. `endpoint` is the display
// string shown in the reset UI and in failure messages, so it spells the prefix out.
export const RESET_STEPS = [
  { key: 'recon', endpoint: `DELETE ${API_PREFIX}/reconciliations`, path: '/reconciliations' },
  { key: 'ledger', endpoint: `DELETE ${API_PREFIX}/ledger-transactions`, path: '/ledger-transactions' },
  { key: 'settle', endpoint: `DELETE ${API_PREFIX}/processor-settlement-transactions`, path: '/processor-settlement-transactions' },
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
