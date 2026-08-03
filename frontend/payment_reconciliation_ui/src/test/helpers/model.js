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

/**
 * The four ways a record can be withheld, cycled so a large fixture exercises every
 * `quarantineReason` branch — and, because the Quarantine table's row height follows how
 * far its reason wraps, every row shape too.
 */
const QUAR_LEDGER = [
  { cardType: '', gross: 1234, currency: 'USD' }, // missing card type
  { cardType: 'VISA', gross: null, currency: 'USD' }, // unparseable amount
  { cardType: 'VISA', gross: 0, currency: 'USD' }, // zero-value
  { cardType: 'VISA', gross: 5678, currency: 'EUR' }, // non-USD
];
const QUAR_SETTLE = [
  { settled: null, currency: 'USD' },
  { settled: 0, currency: 'USD' },
  { settled: 4321, currency: 'GBP' },
  { settled: 9999, currency: 'JPY' },
];

/**
 * The sample model inflated to `n` included rows.
 *
 * For the paths that only engage on a large table — windowing, and the column sizing that
 * has to stay independent of which rows are rendered. Rows are clones of the golden ones
 * with fresh identifiers, so every category, both row shapes (with and without a ledger
 * side) and the multi-part settlements all stay represented at any size.
 *
 * @param {number} n
 * @param {{merchants?: number, quarantined?: number}} [opts]
 *   `merchants` spreads the rows over that many distinct merchant ids, for the rollup,
 *   which has one row per merchant rather than per transaction. `quarantined` appends
 *   that many withheld records to each side; they land in `ledger`/`settle` but never in
 *   `included`, which is exactly where the report expects to find them.
 */
export function largeModel(n, { merchants = 0, quarantined = 0 } = {}) {
  const src = sampleModel().included;
  const ledger = [];
  const settle = [];
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const r = src[i % src.length];
    const sfx = `-c${i}`;
    const merchantId = merchants ? `MERCH-${String(i % merchants).padStart(4, '0')}` : r.merchantId;
    const l = r.ledger ? { ...r.ledger, id: r.ledger.id + sfx, merchantId } : null;
    const settlements = r.settlements.map((x) => ({ ...x, ref: x.ref + sfx, merchantId }));
    if (l) ledger.push(l);
    settlements.forEach((x) => settle.push(x));
    rows.push({ ...r, id: r.id + sfx, merchantId, ledger: l, settlements });
  }

  for (let i = 0; i < quarantined; i += 1) {
    const merchantId = merchants ? `MERCH-${String(i % merchants).padStart(4, '0')}` : 'MERCH-001';
    ledger.push({
      ...QUAR_LEDGER[i % QUAR_LEDGER.length],
      id: `TXN-Q-${i}`,
      merchantId,
      merchantRef: `ORD-Q-${i}`,
      type: 'SALE',
      capturedAt: '2026-06-01',
      category: 'QUARANTINE',
    });
    settle.push({
      ...QUAR_SETTLE[i % QUAR_SETTLE.length],
      ref: `ARN-Q-${i}`,
      merchantId,
      merchantRef: `ORD-Q-${i}`,
      date: '2026-06-02',
      interchange: 0,
      processor: 0,
      category: 'QUARANTINE',
    });
  }

  // `included` is the non-quarantined set, which is what every figure on the report sums.
  return { ledger, settle, rows, included: rows };
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
