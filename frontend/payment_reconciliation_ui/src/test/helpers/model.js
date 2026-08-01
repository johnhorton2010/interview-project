import { normalize } from '../../domain/normalize.js';
import { buildSamplePayload } from '../fixtures/sampleReconciliation.js';

/**
 * The golden model the domain suites already pin: 19 rows, 8 breaks, 5 quarantined,
 * 8 merchants, −$65.64 total discrepancy. `normalize` is pure and no component mutates
 * the model — every sort runs on a `.slice()` — so one instance per test file is safe.
 */
export function sampleModel() {
  return normalize(buildSamplePayload());
}

/** A well-formed payload holding no records — App's `empty` branch. */
export function emptyPayload() {
  return {
    internal_transaction_to_processor_settlements_map: {},
    processor_settlement_to_internal_transactions_map: {},
    merchant_ref_to_transaction_keys_map: {},
  };
}

export { buildSamplePayload };
