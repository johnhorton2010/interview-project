// Build the two-sided break-detail view model for a row (PRD FR-7.5), ported from
// the design's detailFor()/relatedFor(). Pure — the React component renders it and
// owns only the expand/collapse state of related panels.

import { getCategory } from './categories.js';
import { fmt, sfmt } from './format.js';
import { INK, INK2, NEG, POS, SEV_COLOR, SEV_BG, SEV_BORDER } from '../styles/tokens.js';

const MUTED = '#7b8697';

/**
 * One label/value line in a detail panel. `diff` draws the amber highlight the
 * design uses to point at a field that disagrees with the other side — the
 * quarantine detail reuses it to point at the field that failed validation.
 */
export function fieldRow(label, value, mono, diff) {
  return {
    label,
    value,
    mono: !!mono,
    bg: diff ? '#fdf4e3' : 'transparent',
    ring: diff ? '0 0 0 1px #f0dfb8' : 'none',
  };
}

function mrow(label, value, opts = {}) {
  return {
    label,
    value,
    // Every row carries a top rule; only the ones that open a sub-total show it.
    rule: opts.top ? '#e2e6ec' : 'transparent',
    labelColor: opts.strong ? INK : MUTED,
    color: opts.color || INK,
    weight: opts.strong ? 600 : 400,
    size: opts.big ? 14 : 12,
  };
}

/** Ledger-side field rows for a row (empty when there is no ledger side). */
function ledgerFieldsOf(r) {
  const l = r.ledger;
  if (!l) return [];
  return [
    fieldRow('Internal txn ID', l.id, true, false),
    fieldRow('Merchant ID', l.merchantId, true, false),
    fieldRow('Merchant ref', l.merchantRef || '—', true, r.settlements.some((s) => s.merchantRef !== l.merchantRef)),
    fieldRow(
      'Card',
      (l.cardType || '(missing)') + ' ····' + l.cardLast4,
      false,
      r.settlements.some((s) => s.cardType !== l.cardType || s.cardLast4 !== l.cardLast4),
    ),
    fieldRow('Gross amount', fmt(l.gross), true, l.category === 'FEE_DISCREPANCY' || l.category === 'AMOUNT_MISMATCH'),
    fieldRow('Type', l.type === 'SALE' ? 'Sale' : 'Refund', false, false),
    fieldRow('Captured', l.capturedAt, true, l.category === 'WIDE_WINDOW'),
    fieldRow('Currency', l.currency, false, r.settlements.some((s) => s.currency !== l.currency)),
  ];
}

/** Processor-side card(s) for a row (empty when nothing settled). */
function settlementCardsOf(r) {
  const l = r.ledger;
  return r.settlements.map((s, i) => ({
    badge: r.settlements.length > 1 ? `${i + 1} of ${r.settlements.length}` : s.date,
    fields: [
      fieldRow('Network ref', s.ref, true, false),
      fieldRow('Merchant ID', r.merchantId, true, false),
      fieldRow('Merchant ref', s.merchantRef || '—', true, !!l && s.merchantRef !== l.merchantRef),
      fieldRow('Card', s.cardType + ' ····' + s.cardLast4, false, !!l && (s.cardType !== l.cardType || s.cardLast4 !== l.cardLast4)),
      fieldRow('Settled amount', fmt(s.settled), true, r.category === 'FEE_DISCREPANCY' || r.category === 'AMOUNT_MISMATCH'),
      fieldRow('Interchange fee', fmt(s.interchange), true, r.category === 'FEE_DISCREPANCY' || r.category === 'AMOUNT_MISMATCH'),
      fieldRow('Processor fee', fmt(s.processor), true, r.category === 'FEE_DISCREPANCY' || r.category === 'AMOUNT_MISMATCH'),
      fieldRow('Settlement date', s.date, true, r.category === 'WIDE_WINDOW'),
      fieldRow('Currency', s.currency, false, !!l && s.currency !== l.currency),
    ],
  }));
}

/** Linked original-sale / refund rows for a ledger row (one level). */
function relatedFor(r, model) {
  const l = r.ledger;
  if (!l) return { items: [], note: null };
  const sameRef = (x) => x.merchantRef === l.merchantRef && x.merchantRef !== '' && x.id !== l.id;
  if (l.type === 'REFUND') {
    const sale = model.ledger.find((x) => x.type === 'SALE' && sameRef(x));
    if (sale) return { items: [{ label: 'Original sale', txn: sale }], note: null };
    return {
      items: [],
      note: `No original sale under ${l.merchantRef || 'this ref'} in the imported window — check earlier periods.`,
    };
  }
  const refunds = model.ledger.filter((x) => x.type === 'REFUND' && sameRef(x));
  return { items: refunds.map((x) => ({ label: 'Refund against this sale', txn: x })), note: null };
}

/**
 * @param {ReconRow} r
 * @param {object} model
 * @param {number} [depth]  guards related recursion
 */
export function buildDetail(r, model, depth = 0) {
  const meta = getCategory(r.category);

  const ledgerFields = ledgerFieldsOf(r);
  const settlementCards = settlementCardsOf(r);

  const math = [
    mrow('Ledger amount', sfmt(r.rowLedger)),
    mrow('Less fees', '−' + fmt(r.rowFees)),
    mrow('Expected', fmt(r.rowExpected), { top: true, strong: true }),
    mrow('Actual settled', fmt(r.rowActual)),
    mrow('Impact on discrepancy', sfmt(r.rowImpact), {
      top: true,
      strong: true,
      big: true,
      color: r.rowImpact === 0 ? INK2 : r.rowImpact < 0 ? NEG : POS,
    }),
  ];

  // Related original-sale / refund. Each item carries the related row's own ledger
  // fields and settlement cards so the view can render them as blue side-panels in
  // the left/right columns when the item is expanded (design: relLedgerPanels /
  // relSettlementPanels).
  const rel = depth > 0 ? { items: [], note: null } : relatedFor(r, model);
  const related = rel.items.map((it) => {
    const other = model.rows.find((x) => x.id === it.txn.id);
    const rr = other || { ledger: it.txn, settlements: [], rowImpact: 0, category: it.txn.category };
    return {
      id: it.txn.id,
      label: it.label,
      amount: fmt(it.txn.gross),
      sevColor: SEV_COLOR[getCategory(it.txn.category).sev],
      ledgerFields: ledgerFieldsOf(rr),
      settlementCards: settlementCardsOf(rr),
    };
  });

  return {
    id: r.id,
    label: meta.label,
    explain: meta.explain,
    sevColor: SEV_COLOR[meta.sev],
    reasonBg: SEV_BG[meta.sev],
    reasonBorder: SEV_BORDER[meta.sev],
    hasLedger: !!r.ledger,
    ledgerFields,
    settlementCards,
    math,
    related,
    relatedNote: rel.note,
  };
}
