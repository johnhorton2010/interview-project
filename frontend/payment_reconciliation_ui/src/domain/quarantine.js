// Quarantine view models — pure, no React, no DOM.
//
// The backend does not say why it withheld a record, so we derive a best-effort
// explanation from the record itself. Both the Quarantine table's reason column and
// the expanded record card read from `quarantineReason`, so the two can never
// disagree, and the detail can highlight the field the reason blames.

import { getCategory, QUARANTINE } from './categories.js';
import { fieldRow } from './detail.js';
import { fmt } from './format.js';
import { SEV_COLOR, SEV_BG, SEV_BORDER } from '../styles/tokens.js';

export const LEDGER = 'Ledger';
export const SETTLEMENT = 'Settlement';

const reason = (field, text, note) => ({ field, text, note: note || null });

const nonUsd = (ccy) => `Currency ${ccy} — non-USD records are always quarantined.`;

// $0.00 on a withheld record is a cause in its own right, not a fall-through to
// "Failed validation.". It has exactly two origins, and both blame the amount:
//
//   * the source value was not parseable as a number. The backend coerces such a value
//     to zero before serializing — TXN-BAD-002 is `N/A` in the source CSV and arrives as
//     `"gross_amount": 0.0` — so the zero we receive is all that is left of the failure.
//   * a system recorded a sale, refund or settlement of nothing. That is a logical error,
//     not an arithmetic one: a business does not pay a processor to move no money, so a
//     zero-value transaction should never have been sent in the first place.
//
// The rule reads the amount fields only — fee fields never enter into it. A refund
// settlement legitimately carries $0.00 interchange and processor fees, and that says
// nothing about whether the record is valid. It is scoped, too, to records the backend
// already withheld, so a legitimate zero elsewhere is untouched.
const ZERO_NOTE =
  'Either the source value was not parseable as a number and was coerced to zero, or a system ' +
  'recorded a transaction of nothing. Either way, the amount is wrong.';

/**
 * Why a record was withheld, and which of its fields is to blame.
 *
 * `field` names a label from `buildQuarantineDetail`'s field list, or is null when the
 * cause is unknown — the backend may quarantine for a reason we cannot infer, and
 * blaming an arbitrary field would be worse than blaming none. `note` carries the
 * longer reasoning for the detail panel, which has room the table column does not.
 *
 * @param {LedgerTxn|Settlement} rec
 * @param {'Ledger'|'Settlement'} side
 * @returns {{ field: string|null, text: string, note: string|null }}
 */
export function quarantineReason(rec, side) {
  if (side === SETTLEMENT) {
    if (rec.settled === null) return reason('Settled amount', 'Settled amount omitted by the processor.');
    if (rec.settled === 0)
      return reason('Settled amount', '$0.00 a settlement of nothing or originating from an unparseable value.', ZERO_NOTE);
    if (rec.currency && rec.currency !== 'USD') return reason('Currency', nonUsd(rec.currency));
    return reason(null, 'Failed validation.');
  }
  if (!rec.cardType) return reason('Card', 'Missing card type — required field absent.');
  if (rec.gross === null) return reason('Gross amount', 'Gross amount not a parseable number.');
  if (rec.gross === 0)
    return reason(
      'Gross amount',
      `Gross amount $0.00 — unparseable input, or a system error producing a zero-value ${rec.type === 'REFUND' ? 'refund' : 'sale'}.`,
      ZERO_NOTE,
    );
  if (rec.currency && rec.currency !== 'USD') return reason('Currency', nonUsd(rec.currency));
  return reason(null, 'Failed validation.');
}

/** Field order mirrors the break detail's two sides, so both details read the same. */
function fieldsOf(rec, side, blamed) {
  const at = (label, value, mono) => fieldRow(label, value, mono, label === blamed);
  const card = (rec.cardType || '(missing)') + ' ····' + rec.cardLast4;
  if (side === SETTLEMENT) {
    return [
      at('Network ref', rec.ref, true),
      at('Merchant ID', rec.merchantId, true),
      at('Merchant ref', rec.merchantRef || '—', true),
      at('Card', card, false),
      at('Settled amount', fmt(rec.settled), true),
      at('Interchange fee', fmt(rec.interchange), true),
      at('Processor fee', fmt(rec.processor), true),
      at('Settlement date', rec.date, true),
      at('Currency', rec.currency, false),
    ];
  }
  return [
    at('Internal txn ID', rec.id, true),
    at('Merchant ID', rec.merchantId, true),
    at('Merchant ref', rec.merchantRef || '—', true),
    at('Card', card, false),
    at('Gross amount', fmt(rec.gross), true),
    at('Type', rec.type === 'SALE' ? 'Sale' : 'Refund', false),
    at('Captured', rec.capturedAt, true),
    at('Currency', rec.currency, false),
  ];
}

/**
 * One-sided detail for a quarantined record. Deliberately carries no arithmetic: a
 * quarantined record is absent from every figure on the report, and printing an
 * expected/settled/impact block for it — as the break detail does — would invite
 * adding a number the Summary and Merchants tabs both report as N/A.
 *
 * @param {LedgerTxn|Settlement} rec
 * @param {'Ledger'|'Settlement'} side
 */
export function buildQuarantineDetail(rec, side) {
  const meta = getCategory(QUARANTINE);
  const why = quarantineReason(rec, side);
  return {
    side,
    label: meta.label,
    reason: why.text,
    // Only the detail shows this; the table column keeps the one-line reason.
    note: why.note,
    explain: meta.explain,
    fields: fieldsOf(rec, side, why.field),
    sevColor: SEV_COLOR[meta.sev],
    reasonBg: SEV_BG[meta.sev],
    reasonBorder: SEV_BORDER[meta.sev],
  };
}
