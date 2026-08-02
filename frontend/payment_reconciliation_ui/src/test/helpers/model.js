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

/**
 * A payload whose only record is quarantined, so nothing reconciles: every included
 * figure is zero and every category filter would be empty if it were derived from the
 * data. Shape copied from what the backend actually emits for this case — the ledger
 * record reachable only through the settlement map's "null" bucket, and a lone `null`
 * standing in for the settlements it never had.
 */
export function quarantineOnlyPayload() {
  return {
    internal_transaction_to_processor_settlements_map: { 'TXN-BAD-001': [null] },
    processor_settlement_to_internal_transactions_map: {
      null: [
        {
          internal_txn_id: 'TXN-BAD-001',
          merchant_id: 'MERCH-003',
          merchant_ref: 'ORD-BAD-00001',
          card_type: '', // the missing field that quarantines it
          card_last4: '4111',
          gross_amount: 88.0,
          currency: 'USD',
          type: 'SALE',
          captured_at: '2026-06-05T12:00:00Z',
          category: 'QUARANTINE',
        },
      ],
    },
    merchant_ref_to_transaction_keys_map: {
      'ORD-BAD-00001': { internal_transactions: ['TXN-BAD-001'], processor_settlements: [] },
    },
  };
}

/** The sample model with one category's records dropped from every side. */
export function withoutCategory(model, key) {
  return {
    ...model,
    ledger: model.ledger.filter((l) => l.category !== key),
    settle: model.settle.filter((s) => s.category !== key),
    rows: model.rows.filter((r) => r.category !== key),
    included: model.included.filter((r) => r.category !== key),
  };
}

export { buildSamplePayload };
