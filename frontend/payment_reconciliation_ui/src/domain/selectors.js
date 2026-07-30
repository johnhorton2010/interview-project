// All report maths — pure, no React, no DOM. Every headline figure is a pure
// function of the normalised model (PRD §7). If a number is wrong, it is wrong here.
// Ported from the design component's figures()/categoryRows/merchantRows/matchRow.

import { getCategory } from './categories.js';
import { fmt, sfmt, normAmt, amtStrings, dateMatches, isDateish } from './format.js';
import { C, INK, INK2, NEG, POS, SEV_ORDER, SEV_COLOR, SEV_BG, SEV_BORDER } from '../styles/tokens.js';

const DIM = '#9aa3b0';

const isSale = (l) => l.type === 'SALE';
const isRefund = (l) => l.type === 'REFUND';
const notQuar = (x) => x.category !== 'QUARANTINE';

/** Headline figures over included (non-quarantined) records (PRD §7.3). */
export function figures(model) {
  const L = model.ledger.filter(notQuar);
  const S = model.settle.filter(notQuar);
  const sales = L.filter(isSale).reduce((n, l) => n + (l.gross || 0), 0);
  const refunds = L.filter(isRefund).reduce((n, l) => n + Math.abs(l.gross || 0), 0);
  const interchange = S.reduce((n, s) => n + (s.interchange || 0), 0);
  const processor = S.reduce((n, s) => n + (s.processor || 0), 0);
  const fees = interchange + processor;
  const expected = sales - refunds - fees;
  const actual = S.reduce((n, s) => n + (s.settled || 0), 0);
  const breaks = model.included.filter((r) => r.category !== 'CLEAN_MATCH');
  return {
    sales,
    refunds,
    interchange,
    processor,
    fees,
    expected,
    actual,
    discrepancy: expected - actual,
    breakCount: breaks.length,
    // The design's quarantine tile counts withheld records on BOTH sides.
    // (The PRD AC-21 counts the 3 ledger records only; we follow the design here.)
    quarantineCount:
      model.ledger.filter((l) => l.category === 'QUARANTINE').length +
      model.settle.filter((x) => x.category === 'QUARANTINE').length,
    includedLedger: L.length,
    includedSettle: S.length,
    ledgerGrossSigned: L.reduce((n, l) => n + (l.gross || 0), 0),
  };
}

/** Which categories to show, ordered by severity then label. */
function presentCategories(model) {
  const present = new Set();
  model.rows.forEach((r) => present.add(r.category));
  model.settle.forEach((x) => present.add(x.category));
  return [...present]
    .filter(Boolean)
    .sort(
      (a, b) =>
        SEV_ORDER[getCategory(a).sev] - SEV_ORDER[getCategory(b).sev] ||
        getCategory(a).label.localeCompare(getCategory(b).label),
    );
}

/** Category summary rows + totals (PRD §7.5). */
export function categorySummary(model) {
  const rows = presentCategories(model).map((k) => {
    const meta = getCategory(k);
    const ls = model.ledger.filter((l) => l.category === k);
    const ss = model.settle.filter((x) => x.category === k);
    const rs = model.rows.filter((r) => r.category === k);
    const isQuar = k === 'QUARANTINE';
    const rawSales = ls.filter(isSale).reduce((n, l) => n + (l.gross || 0), 0);
    const rawRefunds = ls.filter(isRefund).reduce((n, l) => n + Math.abs(l.gross || 0), 0);
    const rawFees = ss.reduce((n, x) => n + (x.interchange || 0) + (x.processor || 0), 0);
    const rawSettled = ss.reduce((n, x) => n + (x.settled || 0), 0);
    const rawImpact = rs.reduce((n, r) => n + r.rowImpact, 0);
    return {
      key: k,
      label: meta.label,
      severity: meta.sev,
      sevColor: SEV_COLOR[meta.sev],
      sevBg: SEV_BG[meta.sev],
      sevBorder: SEV_BORDER[meta.sev],
      isQuarantine: isQuar,
      // raw cents for export/sort
      rawSales,
      rawRefunds,
      rawFees,
      rawSettled,
      rawImpact,
      rawLedgerN: ls.length,
      rawSettleN: ss.length,
      // display
      ledgerCount: ls.length,
      settleCount: ss.length,
      totalCount: isQuar ? ls.length + ss.length : rs.length,
      sides: ls.length + ' / ' + ss.length,
      dimColor: isQuar ? DIM : INK2,
      // An excluded row is muted by a background band plus one flat ink, never by opacity:
      // opacity composites every cell toward the background and bottoms out at 1.61:1.
      // The band carries the de-emphasis, so the ink can stay dark enough to read —
      // INK2 on borderSoft is 6.45:1. `rowInk` overrides every cell colour below when set.
      // (borderSoft is named for a border; here it is deliberately a row fill.)
      rowInk: isQuar ? INK2 : null,
      bg: isQuar ? C.borderSoft : '#ffffff',
      // Every monetary cell on the excluded row reads N/A, not just expected and impact:
      // quarantined records are absent from all of them, so printing a real figure under
      // Sales or Settled invites adding it into a total it is deliberately outside of.
      // Only the display strings are blanked — `raw*` below keeps the underlying amounts,
      // and the Quarantine tab still lists each record's own figure.
      sales: isQuar ? 'N/A' : rawSales === 0 ? '—' : fmt(rawSales),
      salesColor: ls.some(isSale) ? INK : DIM,
      refunds: isQuar ? 'N/A' : rawRefunds === 0 ? '—' : '−' + fmt(rawRefunds),
      refundColor: ls.some(isRefund) ? NEG : DIM,
      fees: isQuar ? 'N/A' : rawFees === 0 ? '—' : '−' + fmt(rawFees),
      feeColor: ss.some((x) => (x.interchange || 0) + (x.processor || 0) !== 0) ? NEG : DIM,
      expected: isQuar ? 'N/A' : fmt(rawSales - rawRefunds - rawFees),
      settled: isQuar ? 'N/A' : rawSettled === 0 ? '—' : fmt(rawSettled),
      settledColor: ss.length ? INK : DIM,
      impact: isQuar ? 'N/A' : sfmt(rawImpact),
      impactColor: isQuar ? DIM : rawImpact === 0 ? INK2 : rawImpact < 0 ? NEG : POS,
    };
  });

  const f = figures(model);
  const totals = {
    ledgerCount: f.includedLedger,
    settleCount: f.includedSettle,
    totalCount: model.included.length,
    sides: f.includedLedger + ' / ' + f.includedSettle,
    sales: fmt(f.sales),
    ledgerGross: fmt(f.ledgerGrossSigned),
    refunds: '−' + fmt(f.refunds),
    fees: '−' + fmt(f.fees),
    expected: fmt(f.expected),
    settled: fmt(f.actual),
    discrepancy: sfmt(f.discrepancy),
  };
  return { rows, totals };
}

/** Quarantined-record count per merchant (both sides). */
function quarantineByMerchant(model) {
  const q = {};
  model.ledger
    .filter((l) => l.category === 'QUARANTINE')
    .forEach((l) => (q[l.merchantId] = (q[l.merchantId] || 0) + 1));
  model.settle
    .filter((x) => x.category === 'QUARANTINE')
    .forEach((x) => (q[x.merchantId] = (q[x.merchantId] || 0) + 1));
  return q;
}

/** Per-merchant rollup, unioned across both sides, sorted by |discrepancy| (PRD §7.6). */
export function merchantRollup(model) {
  const quarByMerchant = quarantineByMerchant(model);
  const ids = [];
  model.included.forEach((r) => {
    if (ids.indexOf(r.merchantId) < 0) ids.push(r.merchantId);
  });
  Object.keys(quarByMerchant).forEach((id) => {
    if (ids.indexOf(id) < 0) ids.push(id);
  });
  ids.sort();

  const rows = ids
    .map((id) => {
      const rs = model.included.filter((r) => r.merchantId === id);
      const quar = quarByMerchant[id] || 0;
      const quarantineOnly = rs.length === 0;
      const ls = rs.map((r) => r.ledger).filter(Boolean);
      const ss = rs.reduce((acc, r) => acc.concat(r.settlements), []);
      const sales = ls.filter(isSale).reduce((n, l) => n + (l.gross || 0), 0);
      const refunds = ls.filter(isRefund).reduce((n, l) => n + Math.abs(l.gross || 0), 0);
      // Fees are carried as their two parts plus the total: the table prints INTERCHG and
      // PROC ahead of FEES, so each total follows its own inputs.
      const interchange = ss.reduce((n, x) => n + (x.interchange || 0), 0);
      const processor = ss.reduce((n, x) => n + (x.processor || 0), 0);
      const fees = interchange + processor;
      const expected = sales - refunds - fees;
      const settled = ss.reduce((n, x) => n + (x.settled || 0), 0);
      const disc = expected - settled;
      const brk = rs.filter((r) => r.category !== 'CLEAN_MATCH').length;
      const clean = rs.length - brk;
      const na = 'N/A';
      return {
        merchantId: id,
        raw: { sales, refunds, interchange, processor, fees, expected, settled, disc, clean, breaks: brk, quar, quarantineOnly },
        sales: quarantineOnly ? na : fmt(sales),
        refunds: quarantineOnly ? na : fmt(refunds),
        interchange: quarantineOnly ? na : fmt(interchange),
        processor: quarantineOnly ? na : fmt(processor),
        fees: quarantineOnly ? na : fmt(fees),
        expected: quarantineOnly ? na : fmt(expected),
        settled: quarantineOnly ? na : fmt(settled),
        discrepancy: quarantineOnly ? na : sfmt(disc),
        // No row-level mute on this table: the N/A cells say "contributes nothing" more
        // plainly than a colour treatment would, so every N/A renders in normal ink.
        discColor: quarantineOnly ? INK : disc === 0 ? INK2 : disc < 0 ? NEG : POS,
        // The three counts carry no colour of their own: greying a zero put it at 2.55:1,
        // and using a lighter ink for Quarantine than for Breaks drew a distinction the
        // data does not make. They all render in row ink, so the Total row matches too.
        clean: quarantineOnly ? na : clean,
        breaks: quarantineOnly ? na : brk,
        quarantine: quar,
        absDisc: quarantineOnly ? -1 : Math.abs(disc),
        hasBreaks: brk > 0,
        quarantineOnly,
      };
    })
    .sort((a, b) => b.absDisc - a.absDisc);

  const quarTotal = Object.keys(quarByMerchant).reduce((n, k) => n + quarByMerchant[k], 0);
  return { rows, quarTotal };
}

export const refOf = (r) =>
  r.ledger ? r.ledger.merchantRef || '' : r.settlements[0] ? r.settlements[0].merchantRef || '' : '';

// A row holds at most one ledger txn, so exactly one of these is ever non-null. That is
// what lets a Sales/Refunds column pair stand in for a Type column — whichever side is
// populated *is* the type. Refund gross is already negative in the source data, so it
// needs no sign flip. `null` (not 0) means "no such side", which the tables render as
// an em dash and their sort comparators sink to the bottom.
export const saleOf = (r) => (r.ledger && r.ledger.type === 'SALE' ? r.ledger.gross || 0 : null);
export const refundOf = (r) => (r.ledger && r.ledger.type === 'REFUND' ? r.ledger.gross || 0 : null);

/**
 * One search grammar for the Breaks and Transactions tabs: plain text, amounts,
 * dates/ranges, and value-typed qualifiers (captured:, settled:, gross:, …).
 * @param {ReconRow} r
 * @param {string} term  a single lowercased term
 * @param {{ settlementDate?: string, settledAmount?: number, feesAmount?: number }} [opts]
 */
export function matchRow(r, term, opts) {
  const settleDates = r.settlements.map((x) => x.date);
  const capturedOn = r.ledger ? r.ledger.capturedAt : '';
  const settledOn = opts && opts.settlementDate ? [opts.settlementDate] : settleDates;
  const anyDate = (list, val) => list.some((d) => dateMatches(d, val));
  const money = {
    gross: r.ledger ? r.ledger.gross : null,
    settled: opts && opts.settlementDate ? opts.settledAmount : r.rowActual,
    fees: opts && opts.settlementDate ? opts.feesAmount : r.rowFees,
    disc: r.rowImpact,
  };
  const moneyHit = (val, keys) => {
    const n = normAmt(val).replace(/^-/, '');
    if (!n || !/^[\d.]+$/.test(n)) return false;
    return keys
      .reduce((acc, k) => acc.concat(amtStrings(money[k])), [])
      .some((a) => a.indexOf(n) >= 0);
  };
  const ids = [r.ledger ? r.ledger.id : ''].concat(r.settlements.map((x) => x.ref)).filter(Boolean);
  const refs = [r.ledger ? r.ledger.merchantRef : '']
    .concat(r.settlements.map((x) => x.merchantRef))
    .filter(Boolean);
  const typeWord = r.ledger ? (r.ledger.type === 'SALE' ? 'sale' : 'refund') : '';
  const catLabel = getCategory(r.category).label.toLowerCase();
  const has = (list, val) => list.join(' ').toLowerCase().indexOf(val) >= 0;

  const q = /^(captured|settled|merchant|ref|id|type|category|gross|fees|disc|amount)[:=](.+)$/.exec(term);
  if (q) {
    const field = q[1];
    const val = q[2];
    if (field === 'captured') return dateMatches(capturedOn, val);
    if (field === 'settled') return isDateish(val) ? anyDate(settledOn, val) : moneyHit(val, ['settled']);
    if (field === 'merchant') return String(r.merchantId).toLowerCase().indexOf(val) >= 0;
    if (field === 'id') return has(ids, val);
    if (field === 'ref') return has(refs, val);
    if (field === 'type') return typeWord.indexOf(val) === 0;
    if (field === 'category') return catLabel.indexOf(val) >= 0;
    if (field === 'gross') return moneyHit(val, ['gross']);
    if (field === 'fees') return moneyHit(val, ['fees']);
    if (field === 'disc') return moneyHit(val, ['disc']);
    if (field === 'amount') return moneyHit(val, ['gross', 'settled', 'fees', 'disc']);
    return false;
  }
  if (isDateish(term) && (dateMatches(capturedOn, term) || anyDate(settledOn, term))) return true;
  const n = normAmt(term);
  if (/^-?[\d.]+$/.test(n) && n.indexOf('.') >= 0 && moneyHit(term, ['gross', 'settled', 'fees', 'disc']))
    return true;
  return [r.merchantId, catLabel, typeWord].concat(ids, refs).join(' ').toLowerCase().indexOf(term) >= 0;
}

/** Split a query into lowercased terms; all must match (AND). Empty query matches all. */
const everyTerm = (query, fn) =>
  String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every(fn);

/** All search terms must match (AND). */
export function matchAll(r, query, opts) {
  return everyTerm(query, (t) => matchRow(r, t, opts));
}

/**
 * Search grammar for a merchant rollup row, deliberately narrower than `matchRow`: a
 * rollup has no ids, network refs, dates, type or category to match on — just the
 * merchant id and a block of money. So plain text matches the id, and a decimal matches
 * any money column, mirroring the amount rule the other two tabs use.
 * @param {object} m  a row from `merchantRollup`
 */
export function matchMerchant(m, term) {
  const n = normAmt(term);
  if (/^-?[\d.]+$/.test(n) && n.indexOf('.') >= 0) {
    const { sales, refunds, interchange, processor, fees, expected, settled, disc } = m.raw;
    return [sales, refunds, interchange, processor, fees, expected, settled, disc]
      .reduce((acc, c) => acc.concat(amtStrings(c)), [])
      .some((a) => a.indexOf(n.replace(/^-/, '')) >= 0);
  }
  return String(m.merchantId).toLowerCase().indexOf(term) >= 0;
}

/** All search terms must match (AND), over a merchant rollup row. */
export function matchMerchantAll(m, query) {
  return everyTerm(query, (t) => matchMerchant(m, t));
}
