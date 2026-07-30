// Convert the GET /reconciliations link-graph payload into the flat model the rest
// of the app consumes (PRD §6). The payload is a link graph, not a report: a
// record's category is only readable from the *opposite* map, records repeat across
// keys, and the unmatched bucket is the literal string key "null".
//
// The payload is snake_case throughout, top-level map names included, since the
// backend adopted Jackson's SNAKE_CASE naming strategy.
//
// Field names below match the design component's model shape (id / gross / ref /
// settled / interchange / processor / date) so the design's presentation logic ports
// with minimal translation. Amounts are integer cents.

import { toCents } from './money.js';

/** First present value among the given keys. */
function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

/** @returns {LedgerTxn|null} */
function normLedger(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: pick(raw, 'internal_txn_id', 'internalTxnId') ?? '',
    merchantId: pick(raw, 'merchant_id', 'merchantId') ?? '(unknown)',
    merchantRef: pick(raw, 'merchant_ref', 'merchantRef') ?? '',
    cardType: pick(raw, 'card_type', 'cardType') ?? '',
    cardLast4: pick(raw, 'card_last4', 'cardLast4') ?? '',
    gross: toCents(pick(raw, 'gross_amount', 'grossAmount')),
    currency: pick(raw, 'currency') ?? '',
    type: pick(raw, 'type') ?? '',
    capturedAt: capturedDate(pick(raw, 'captured_at', 'capturedAt') ?? ''),
    category: pick(raw, 'category') ?? '',
  };
}

/** @returns {Settlement|null} */
function normSettlement(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    ref: pick(raw, 'network_ref', 'networkRef') ?? '',
    merchantRef: pick(raw, 'merchant_ref', 'merchantRef') ?? '',
    merchantId: pick(raw, 'merchant_id', 'merchantId') ?? '(unknown)',
    cardType: pick(raw, 'card_type', 'cardType') ?? '',
    cardLast4: pick(raw, 'card_last4', 'cardLast4') ?? '',
    settled: toCents(pick(raw, 'settled_amount', 'settledAmount')),
    interchange: toCents(pick(raw, 'interchange_fee', 'interchangeFee')) ?? 0,
    processor: toCents(pick(raw, 'processor_fee', 'processorFee')) ?? 0,
    currency: pick(raw, 'currency') ?? '',
    date: String(pick(raw, 'settlement_date', 'settlementDate') ?? '').slice(0, 10),
    category: pick(raw, 'category') ?? '',
  };
}

// captured_at is an ISO timestamp; the UI only ever shows/sorts the date part.
function capturedDate(v) {
  return String(v || '').slice(0, 10);
}

/** Aggregate figures intrinsic to a single reconciliation row (PRD §7.4). */
function withRowFigures(row) {
  const l = row.ledger;
  const rowLedger = l ? (l.type === 'SALE' ? l.gross || 0 : -Math.abs(l.gross || 0)) : 0;
  const rowFees = row.settlements.reduce((n, s) => n + (s.interchange || 0) + (s.processor || 0), 0);
  const rowActual = row.settlements.reduce((n, s) => n + (s.settled || 0), 0);
  return {
    ...row,
    rowLedger,
    rowFees,
    rowExpected: rowLedger - rowFees,
    rowActual,
    rowImpact: rowLedger - rowFees - rowActual,
    date: row.settlements.length ? row.settlements[row.settlements.length - 1].date : '—',
  };
}

const NULL_KEY = 'null';

/**
 * Normalise the three-map payload into the app model.
 * @param {object} payload
 * @returns {{ ledger: LedgerTxn[], settle: Settlement[], rows: ReconRow[], included: ReconRow[] }}
 */
export function normalize(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const intToStl = p.internal_transaction_to_processor_settlements_map;
  const stlToInt = p.processor_settlement_to_internal_transactions_map;

  // The canonical map is read with no fallback (PRD D4): a missing key is an error.
  if (!stlToInt || typeof stlToInt !== 'object') {
    throw new Error(
      'Malformed reconciliation payload: processor_settlement_to_internal_transactions_map is missing.',
    );
  }
  if (!intToStl || typeof intToStl !== 'object') {
    throw new Error(
      'Malformed reconciliation payload: internal_transaction_to_processor_settlements_map is missing.',
    );
  }

  // 1. Authoritative ledger list = union of the settlement→internal map's values.
  const ledgerById = {};
  for (const arr of Object.values(stlToInt)) {
    if (!Array.isArray(arr)) continue;
    for (const el of arr) {
      const l = normLedger(el);
      if (l && l.id) ledgerById[l.id] = l; // last write wins; de-dupes repeats
    }
  }

  // 2. Authoritative settlement list = union of the internal→settlements map's values.
  const settlementsByRef = {};
  for (const arr of Object.values(intToStl)) {
    if (!Array.isArray(arr)) continue;
    for (const el of arr) {
      const s = normSettlement(el);
      if (s && s.ref) settlementsByRef[s.ref] = s;
    }
  }

  const rows = [];

  // 3. One ledger-anchored row per non-"null" key of the internal→settlements map.
  for (const [k, arr] of Object.entries(intToStl)) {
    if (k === NULL_KEY) continue;
    const ledger = ledgerById[k] || null;
    // Reuse the de-duped settlement objects so identical repeats share identity.
    const settlements = (Array.isArray(arr) ? arr : [])
      .map((el) => {
        const s = normSettlement(el);
        return s && settlementsByRef[s.ref] ? settlementsByRef[s.ref] : s;
      })
      .filter(Boolean);
    const category = ledger ? ledger.category : settlements[0] ? settlements[0].category : '';

    // Canary: both sides of a link should agree on category (PRD §6.3 step 5).
    if (ledger) {
      for (const s of settlements) {
        if (s.category && s.category !== ledger.category) {
          // eslint-disable-next-line no-console
          console.warn(
            `Category disagreement on ${k}: ledger=${ledger.category} settlement=${s.category}; keeping ledger's.`,
          );
        }
      }
    }

    rows.push(
      withRowFigures({
        id: k,
        category,
        ledger,
        settlements,
        merchantId: (ledger && ledger.merchantId) || (settlements[0] && settlements[0].merchantId) || '(unknown)',
      }),
    );
  }

  // 4. One settlement-only row per non-null element of the "null" bucket.
  const orphanSettlements = Array.isArray(intToStl[NULL_KEY]) ? intToStl[NULL_KEY] : [];
  for (const el of orphanSettlements) {
    const s0 = normSettlement(el);
    if (!s0) continue;
    const s = settlementsByRef[s0.ref] || s0;
    rows.push(
      withRowFigures({
        id: s.ref,
        category: s.category,
        ledger: null,
        settlements: [s],
        merchantId: s.merchantId || '(unknown)',
      }),
    );
  }

  return {
    ledger: Object.values(ledgerById),
    settle: Object.values(settlementsByRef),
    rows,
    included: rows.filter((r) => r.category !== 'QUARANTINE'),
  };
}
