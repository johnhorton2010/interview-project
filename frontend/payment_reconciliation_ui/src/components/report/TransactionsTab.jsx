import React, { useRef } from 'react';
import { matchAll, refOf, figures, saleOf, refundOf } from '../../domain/selectors.js';
import { getCategory } from '../../domain/categories.js';
import { fmt, sfmt, dec, shortRefOf, downloadCsv } from '../../domain/format.js';
import { C, MONO, SANS, INK, INK2, NEG, POS, ACCENT, SEV_ORDER, SEV_COLOR } from '../../styles/tokens.js';
import { useColumns } from '../../styles/columns.js';
import { HoverRow, SevDot, GhostButton, useDismiss, SegGroup, copyText } from '../common.jsx';
import SearchHelp from './SearchHelp.jsx';
import BreakDetail from '../BreakDetail.jsx';

/**
 * Band above a group of one-sided rows. Optionally carries its own column labels,
 * for bands where a column holds the other side's value than the main header names
 * (e.g. the id column holds a network ref under an "unattributed settlements" band).
 *
 * The labels are inert text, not `role="columnheader"` buttons: sorting is
 * table-global, so a second set of controls would be ambiguous, and a mid-table
 * header row would confuse the surrounding `role="table"` semantics.
 */
const SectionHeader = ({ children, labels, overrides, template, gap, col }) => (
  <div style={{ padding: '8px 16px', background: '#f7f8fa', borderBottom: `1px solid ${C.borderSoft}`, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7b8697' }}>
    {/* Optional: a band may carry only column labels, with no caption above them. */}
    {children && <div>{children}</div>}
    {labels && (
      // `data-col-labels` opts this line into useColumns' content measurement.
      <div data-col-labels style={{ display: 'grid', gridTemplateColumns: template, gap, marginTop: children ? 6 : 0, color: '#9aa3b0' }}>
        {/* Order comes from LSPEC, not from the label map's key order, so the two
            can never desync — the same positional coupling renderRow relies on. */}
        {LSPEC.map(({ key }) => (
          <span key={key} style={{ ...col(key), whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {(overrides && overrides[key]) || labels[key]}
          </span>
        ))}
      </div>
    )}
  </div>
);

// Subline under a transaction row, matching the design (mono, 11px, muted). When
// `disabled` it states an absence ("no settlement") — there is nothing to copy, so
// it renders as plain text rather than offering a copy affordance that cannot work.
const Subline = ({ text, label, display, onToggle, flash, note, disabled }) => (
  <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 7px', marginTop: -4, cursor: 'pointer', fontFamily: MONO, fontSize: 11, color: '#7b8697', whiteSpace: 'nowrap' }}>
    {disabled ? (
      <span style={{ color: '#c2c8d2' }}>{display}</span>
    ) : (
      <button type="button" title={`Copy ${label.toLowerCase()}`} onClick={(e) => { e.stopPropagation(); copyText(text, label, flash); }} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'copy' }}>
        {display}
      </button>
    )}
    {note && <span style={{ fontSize: 10, color: '#9aa3b0' }}>{note}</span>}
  </div>
);

// Click-to-copy identifier, mono and inheriting row ink until hovered.
const CopyButton = ({ text, label, display, flash }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      title={`Copy ${label.toLowerCase()}`}
      onClick={(e) => { e.stopPropagation(); copyText(text, label, flash); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: hover ? ACCENT : INK, cursor: 'copy' }}
    >
      {display}
    </button>
  );
};

// Text group, then one uniformly right-aligned measure block. `category` trails the
// measure block; useColumns pads it automatically so that boundary is not pinched.
const LSPEC = [
  { key: 'id', min: 64 },
  { key: 'captured', min: 64 },
  { key: 'merchant', min: 64 },
  { key: 'ref', min: 88 },
  // Sales → Refunds → Fees → Exp pay → Settled → Discrepancy reads left to right as the
  // arithmetic the report is built on, and matches the Summary and Merchants tables.
  // There is no Type column: a row holds at most one ledger txn, so whichever of Sales
  // or Refunds is populated *is* the type. NOTE: `renderRow` styles cells by position,
  // so this order and every body-cell array below must stay in lockstep.
  { key: 'sales', min: 64, align: 'right' },
  { key: 'refunds', min: 64, align: 'right' },
  { key: 'fees', min: 48, align: 'right' },
  { key: 'expected', min: 64, align: 'right' },
  { key: 'settled', min: 64, align: 'right' },
  { key: 'disc', min: 64, align: 'right' },
  { key: 'category', min: 120 },
  // Follows the left-aligned `category`, whose trailing void already supplies the
  // gutter, so the caret must not claim slack of its own.
  { key: 'caret', min: 8, fixed: true, align: 'right' },
];
const SSPEC = LSPEC;

const NATURAL = { id: 'asc', captured: 'desc', merchant: 'asc', ref: 'asc', sales: 'desc', refunds: 'desc', expected: 'desc', settled: 'desc', fees: 'desc', disc: 'desc', category: 'asc' };

// One source of truth for column labels, shared by the main header and the band
// headers so a rename cannot leave the two disagreeing. Only `id` and `captured`
// differ between the views.
const LEDGER_LABELS = {
  id: 'Txn id',
  captured: 'Captured on',
  merchant: 'Merchant',
  ref: 'Merchant ref',
  sales: 'Sales',
  refunds: 'Refunds',
  fees: 'Fees',
  expected: 'Exp pay',
  settled: 'Settled',
  disc: 'Discrepancy',
  category: 'Category',
  caret: '',
};
const LABELS = {
  ledger: LEDGER_LABELS,
  settlement: { ...LEDGER_LABELS, id: 'Network ref', captured: 'Settled on' },
};

// Search grammar, also offered via the `?` popover. Unlike the Breaks variant this
// names type and fees, which only exist here.
const SEARCH_TITLE =
  'Terms are combined with AND. Plain text matches ids, merchant, refs, type and category. ' +
  'A decimal matches sales, refunds, settled, fees or discrepancy. A date or range (2026-06-01..2026-06-05) ' +
  'matches either date column; prefix with captured: or settled: to pin it to one.';

const str = (a, b) => String(a || '').localeCompare(String(b || ''));
const num = (a, b) => (a === null ? 0 : a) - (b === null ? 0 : b);

function SortH({ label, k, tx, setTx, colStyle }) {
  const active = tx.sortKey === k;
  const onClick = () => setTx((t) => (t.sortKey === k ? { ...t, sortKey: k, sortDir: t.sortDir === 'asc' ? 'desc' : 'asc' } : { ...t, sortKey: k, sortDir: NATURAL[k] }));
  return (
    <button type="button" role="columnheader" aria-sort={active ? (tx.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={onClick} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', ...colStyle }}>
      {label}
      {active ? (tx.sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

export default function TransactionsTab({ model, tx, setTx, expanded, setExpanded, flash }) {
  const catMenuRef = useDismiss(tx.catOpen, () => setTx((t) => ({ ...t, catOpen: false })));
  const tableRef = useRef(null);
  const { template: COLS, gap: GAP, cell: col } = useColumns(tableRef, LSPEC);
  const f = figures(model);
  const settleCentric = tx.view === 'settlement';
  const L = LABELS[settleCentric ? 'settlement' : 'ledger'];

  const txVisible = model.included.filter((r) => {
    if (tx.cats.length && !tx.cats.includes(r.category)) return false;
    if (tx.type !== 'all' && (!r.ledger || r.ledger.type !== tx.type)) return false;
    return matchAll(r, tx.query);
  });

  const flip = tx.sortDir === 'asc' ? 1 : -1;
  const catCounts = {};
  model.included.forEach((r) => (catCounts[r.category] = (catCounts[r.category] || 0) + 1));
  const catOptions = Object.keys(catCounts).sort(
    (a, b) => SEV_ORDER[getCategory(a).sev] - SEV_ORDER[getCategory(b).sev] || getCategory(a).label.localeCompare(getCategory(b).label),
  );

  // ---- ledger view rows
  const ledgerCmp = {
    id: (a, b) => str(a.ledger ? a.ledger.id : '', b.ledger ? b.ledger.id : ''),
    captured: (a, b) => str(a.ledger ? a.ledger.capturedAt : '', b.ledger ? b.ledger.capturedAt : ''),
    merchant: (a, b) => str(a.merchantId, b.merchantId),
    ref: (a, b) => str(refOf(a), refOf(b)),
    sales: (a, b) => num(saleOf(a), saleOf(b)),
    refunds: (a, b) => num(refundOf(a), refundOf(b)),
    expected: (a, b) => num(a.rowExpected, b.rowExpected),
    settled: (a, b) => num(a.rowActual, b.rowActual),
    fees: (a, b) => num(a.rowFees, b.rowFees),
    disc: (a, b) => Math.abs(a.rowImpact) - Math.abs(b.rowImpact),
    category: (a, b) => getCategory(a.category).label.localeCompare(getCategory(b.category).label),
  };
  const lBase = ledgerCmp[tx.sortKey] || ledgerCmp.disc;
  const ledgerRows = txVisible.filter((r) => r.ledger).slice().sort((a, b) => lBase(a, b) * flip || a.id.localeCompare(b.id));
  const orphanRows = txVisible.filter((r) => !r.ledger);

  // ---- settlement view rows (grouped, contiguous parts, 〃 for carried figures)
  const feesOf = (x) => (x.interchange || 0) + (x.processor || 0);
  const settleCmp = {
    id: (a, b) => str(a.x.ref, b.x.ref),
    captured: (a, b) => str(a.x.date, b.x.date),
    merchant: (a, b) => str(a.x.merchantId, b.x.merchantId),
    ref: (a, b) => str(a.x.merchantRef, b.x.merchantRef),
    sales: (a, b) => num(saleOf(a.r), saleOf(b.r)),
    refunds: (a, b) => num(refundOf(a.r), refundOf(b.r)),
    expected: (a, b) => num(a.r.rowExpected, b.r.rowExpected),
    settled: (a, b) => num(a.x.settled, b.x.settled),
    fees: (a, b) => num(feesOf(a.x), feesOf(b.x)),
    disc: (a, b) => Math.abs(a.r.rowImpact) - Math.abs(b.r.rowImpact),
    category: (a, b) => getCategory(a.r.category).label.localeCompare(getCategory(b.r.category).label),
  };
  const sBase = settleCmp[tx.sortKey] || settleCmp.disc;
  const sCmp = (a, b) => sBase(a, b) * flip || str(a.x.ref, b.x.ref);
  const groupMap = new Map();
  txVisible.forEach((r) => r.settlements.forEach((x) => {
    if (!groupMap.has(r.id)) groupMap.set(r.id, []);
    groupMap.get(r.id).push({ r, x });
  }));
  const groups = [...groupMap.values()];
  groups.forEach((g) => g.sort(sCmp));
  groups.sort((a, b) => sCmp(a[0], b[0]));
  const settleRows = groups.flat();
  const carrierOf = {};
  settleRows.forEach((o) => {
    if (carrierOf[o.r.id] === undefined) carrierOf[o.r.id] = o.r.settlements.indexOf(o.x) + 1;
  });
  const neverSettled = txVisible.filter((r) => r.ledger && r.settlements.length === 0);

  // ---- totals
  // Always reduce over distinct ReconRows, never over rendered rows: in settlement view
  // one transaction spans several rows, and its ledger-side figures belong to the
  // transaction (hence the 〃 on later parts), so per-row sums would double-count them.
  const totalsOf = (rows) => ({
    sales: rows.reduce((n, r) => n + (saleOf(r) || 0), 0),
    refunds: rows.reduce((n, r) => n + (refundOf(r) || 0), 0),
    fees: rows.reduce((n, r) => n + r.rowFees, 0),
    expected: rows.reduce((n, r) => n + r.rowExpected, 0),
    settled: rows.reduce((n, r) => n + r.rowActual, 0),
    impact: rows.reduce((n, r) => n + r.rowImpact, 0),
  });

  // The two bands partition txVisible in both views, so sec1 + sec2 = the grand total.
  const sec1 = settleCentric ? txVisible.filter((r) => r.settlements.length > 0) : ledgerRows;
  const sec2 = settleCentric ? neverSettled : orphanRows;
  // Only worth splitting out subtotals when both bands actually have rows — otherwise a
  // subtotal just restates the grand total sitting directly beneath it.
  const split = sec1.length > 0 && sec2.length > 0;

  // Both views count what they put on screen, in the same unit: ledger renders one row per
  // ReconRow, settlement one per settlement plus one per never-settled transaction. Counting
  // settlements in one view and rows in the other made the two incomparable, and left the
  // settlement ladder unable to add up.
  const visibleRowCount = settleCentric ? settleRows.length + neverSettled.length : txVisible.length;

  const grand = totalsOf(txVisible);
  const txImpact = grand.impact;
  const txAll = txVisible.length === model.included.length;
  const tieOk = !txAll || txImpact === f.discrepancy;

  // Footer strip: tie-out note on the left, standing caveat on the right (design lines 729–732).
  const tieNote = txAll
    ? tieOk
      ? settleCentric
        // Settlement view states the tie-out rather than summing impact: impact is
        // transaction-level, so adding it across settlement rows would double-count.
        ? `All ${visibleRowCount} included rows — expected minus settled still nets to ${sfmt(f.discrepancy)}`
        : `All ${visibleRowCount} included rows — impact sums to ${sfmt(txImpact)}, matching the headline discrepancy`
      : `Impact sums to ${sfmt(txImpact)} but the headline discrepancy is ${sfmt(f.discrepancy)} — the report has a bug`
    : `Filtered view — totals cover the ${visibleRowCount} visible rows, not the full dataset`;
  const footnote = settleCentric
    ? '〃 repeats the sales, refunds, expected pay and discrepancy printed on the row above for the same ledger transaction — those figures belong to the transaction, not to each payout, so they are counted once. Quarantined records are excluded; see the Quarantine tab.'
    : 'Quarantined records are excluded — see the Quarantine tab.';

  const exportCsv = () => {
    let n;
    if (settleCentric) {
      const rows = settleRows
        .map((o) => {
          const parts = o.r.settlements.length;
          const idx = o.r.settlements.indexOf(o.x);
          const carrier = carrierOf[o.r.id] === idx + 1;
          return [o.x.ref, parts > 1 ? `${idx + 1}/${parts}` : '', o.x.date, o.x.merchantId, o.x.merchantRef || '', carrier ? dec(saleOf(o.r)) : '', carrier ? dec(refundOf(o.r)) : '', dec(feesOf(o.x)), carrier ? dec(o.r.rowExpected) : '', dec(o.x.settled), carrier ? dec(o.r.rowImpact) : '', getCategory(o.r.category).label, o.r.ledger ? o.r.ledger.id : ''];
        })
        .concat(neverSettled.map((r) => ['', '', '', r.merchantId, r.ledger.merchantRef || '', dec(saleOf(r)), dec(refundOf(r)), '', dec(r.rowExpected), '', dec(r.rowImpact), getCategory(r.category).label, r.ledger.id]));
      n = downloadCsv('transactions-by-settlement.csv', ['Network ref', 'Part', 'Settled on', 'Merchant', 'Merchant ref', 'Sales', 'Refunds', 'Fees', 'Exp pay', 'Settled', 'Discrepancy', 'Category', 'Ledger txn'], rows);
    } else {
      n = downloadCsv(
        'transactions.csv',
        ['Txn id', 'Captured on', 'Merchant', 'Merchant ref', 'Sales', 'Refunds', 'Fees', 'Exp pay', 'Settled', 'Discrepancy', 'Category', 'Network refs'],
        txVisible.map((r) => [r.ledger ? r.ledger.id : '', r.ledger ? r.ledger.capturedAt : '', r.merchantId, r.ledger ? r.ledger.merchantRef || '' : r.settlements[0].merchantRef || '', dec(saleOf(r)), dec(refundOf(r)), dec(r.rowFees), dec(r.rowExpected), r.settlements.length ? dec(r.rowActual) : '', dec(r.rowImpact), getCategory(r.category).label, r.settlements.map((x) => x.ref).join(' ')]),
      );
    }
    flash(`${settleCentric ? 'transactions-by-settlement.csv' : 'transactions.csv'} — ${n} rows exported`);
  };

  const catLabel = tx.cats.length === 0 ? 'All categories' : tx.cats.length === 1 ? getCategory(tx.cats[0]).label : `${tx.cats.length} categories`;
  const impCol = (c) => (c === 0 ? INK2 : c < 0 ? NEG : POS);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const grandCount = plural(visibleRowCount, 'row');

  // The band above the grand total names only the columns that row fills. The cells it
  // leaves empty are blanked rather than labelled, and `ref` is renamed: it holds the row
  // count, not a merchant ref. "Count" rather than "Rows" so the header does not repeat
  // the noun already in the value ("18 rows").
  const grandBandLabels = { ...L, id: '', captured: '', merchant: '', ref: 'Count', category: '' };

  const renderRow = (key, cols, cells, row, subline) => {
    const open = expanded === key;
    const toggle = () => setExpanded(open ? null : key);
    return (
      // Hover lives on the wrapper so the cells, the subline and the expanded
      // detail all tint together as one row (design lines 540/560, 643/663).
      <HoverRow key={key} style={{ borderBottom: `1px solid ${C.rowRule}` }} hoverStyle={{ background: C.hover }}>
        <div role="row" aria-expanded={open} onClick={toggle} style={{ display: 'grid', gridTemplateColumns: cols, gap: GAP, padding: '10px 16px', cursor: 'pointer', background: open ? C.hover : 'transparent', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', alignItems: 'center' }}>
          {/* Alignment and R5 padding come from the spec by position, so body cells
              can never drift out of step with the header row. */}
          {cells.map((c, i) =>
            React.isValidElement(c)
              ? React.cloneElement(c, { key: i, style: { ...c.props.style, ...col(LSPEC[i].key) } })
              : c,
          )}
        </div>
        {subline && React.cloneElement(subline, { onToggle: toggle, flash })}
        {open && row && <BreakDetail row={row} model={model} />}
      </HoverRow>
    );
  };

  const cell = (content, opts = {}) => (
    <span role="cell" style={{ textAlign: opts.right ? 'right' : 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: opts.color || INK, fontFamily: opts.sans ? SANS : MONO, fontWeight: opts.weight, fontSize: opts.size }} title={opts.title}>
      {content}
    </span>
  );

  /** Category cell: severity swatch plus the label in row ink (design lines 553, 656). */
  const catCell = (category) => (
    <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: SANS, fontSize: 12, minWidth: 0 }}>
      <SevDot color={SEV_COLOR[getCategory(category).sev]} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCategory(category).label}</span>
    </span>
  );

  /** Identifier cell: click-to-copy, matching the design's `onCopyId` buttons. */
  const idCell = (display, text, label) => (
    <span role="cell" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      <CopyButton text={text} label={label} display={display} flash={flash} />
    </span>
  );

  const renderLedgerRow = (r) => {
    // '—' not '$0.00' when nothing settled, matching BreaksTab. A row folding several
    // payouts into this sum is flagged by the subline's ref count and by its category,
    // so the figure itself carries no marker.
    const settled = r.settlements.length ? fmt(r.rowActual) : '—';
    const refs = r.settlements.map((x) => x.ref);
    const refDisplay = refs.length ? shortRefOf(refs[0]) + (refs.length > 1 ? ` +${refs.length - 1}` : '') : '';
    return renderRow(
      r.id,
      COLS,
      [
        r.ledger
          ? idCell(r.ledger.id, r.ledger.id, 'Identifier')
          : idCell(shortRefOf(r.settlements[0].ref), r.settlements[0].ref, 'Network ref'),
        cell(r.ledger ? r.ledger.capturedAt : 'no ledger', { color: INK2, size: 12 }),
        cell(r.merchantId, { color: INK2, size: 12 }),
        cell(r.ledger ? r.ledger.merchantRef || '—' : r.settlements[0].merchantRef || '—', { color: INK2, size: 12 }),
        cell(saleOf(r) === null ? '—' : fmt(saleOf(r)), { right: true }),
        cell(refundOf(r) === null ? '—' : fmt(refundOf(r)), { right: true, color: refundOf(r) === null ? undefined : NEG }),
        cell(fmt(r.rowFees), { right: true, color: INK2 }),
        cell(fmt(r.rowExpected), { right: true }),
        cell(settled, { right: true }),
        cell(sfmt(r.rowImpact), { right: true, weight: 500, color: impCol(r.rowImpact) }),
        catCell(r.category),
        cell(expanded === r.id ? '▴' : '▾', { right: true, color: '#9aa3b0', size: 11 }),
      ],
      r,
      // Gated on the ledger side, not on refs (design: `hasRefSubline: !!r.ledger`).
      // An unattributed row already shows its network ref in the id cell, so a subline
      // there would repeat it verbatim; a row with a ledger side but no payout instead
      // states the absence.
      r.ledger ? (
        <Subline
          text={refs.join(' ')}
          label={refs.length > 1 ? 'Network refs' : 'Network ref'}
          display={refs.length ? refDisplay : 'no settlement'}
          disabled={!refs.length}
        />
      ) : null,
    );
  };

  /**
   * Summary row over the measure columns, positionally matched to LSPEC like the body
   * rows. `strong` marks the grand total: it keeps the firm rule the single Total row
   * always had, while the subtotals sit under a softer one so the three read as a
   * hierarchy rather than three equal rows.
   */
  const totalRow = (key, label, count, t, strong) => (
    <div key={key} role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: GAP, padding: '11px 16px', borderTop: `1px solid ${strong ? C.borderStrong : C.borderSoft}`, background: C.surfaceAlt, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
      <span role="cell" style={{ fontFamily: SANS, fontSize: 12, fontWeight: strong ? 600 : 400 }}>{label}</span>
      <span /><span />
      {/* Merchant ref is the last text column before the measure block, so the count
          goes there in both views — it is the only slot left that is not money. */}
      <span role="cell" style={{ fontFamily: SANS, fontSize: 12, color: INK2 }}>{count}</span>
      <span role="cell" style={{ textAlign: 'right' }}>{fmt(t.sales)}</span>
      <span role="cell" style={{ textAlign: 'right', color: t.refunds === 0 ? undefined : NEG }}>{fmt(t.refunds)}</span>
      <span role="cell" style={{ textAlign: 'right' }}>{fmt(t.fees)}</span>
      <span role="cell" style={{ textAlign: 'right' }}>{fmt(t.expected)}</span>
      <span role="cell" style={{ textAlign: 'right' }}>{fmt(t.settled)}</span>
      <span role="cell" style={{ textAlign: 'right', color: impCol(t.impact) }}>{sfmt(t.impact)}</span>
      <span /><span />
    </div>
  );

  return (
    <section>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px 8px 0 0', borderBottom: 0, padding: '12px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <input type="search" value={tx.query} onChange={(e) => setTx((t) => ({ ...t, query: e.target.value }))} placeholder="Search id, merchant, ref, amount, or date — e.g. captured:2026-06-01..2026-06-05" title={SEARCH_TITLE} style={{ flex: 1, minWidth: 220, padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, color: INK }} />
        <SearchHelp
          open={tx.helpOpen}
          onToggle={() => setTx((t) => ({ ...t, helpOpen: !t.helpOpen }))}
          onClose={() => setTx((t) => ({ ...t, helpOpen: false }))}
          align="left"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#9aa3b0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>View</span>
          <SegGroup
            options={[
              { label: 'Ledger', on: !settleCentric, title: 'One row per internal ledger transaction', onClick: () => setTx((t) => ({ ...t, view: 'ledger' })) },
              { label: 'Settlement', on: settleCentric, title: 'One row per processor settlement', onClick: () => setTx((t) => ({ ...t, view: 'settlement' })) },
            ]}
          />
        </div>
        <div ref={catMenuRef} style={{ position: 'relative' }}>
          <button type="button" aria-expanded={tx.catOpen} onClick={() => setTx((t) => ({ ...t, catOpen: !t.catOpen }))} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${tx.cats.length ? '#bcd0f5' : C.border}`, background: tx.cats.length ? '#eaf0fd' : '#fff', color: tx.cats.length ? ACCENT : INK2, padding: '6px 10px', fontSize: 12, borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <span>{catLabel}</span>
            <span aria-hidden="true" style={{ color: '#9aa3b0', fontSize: 10 }}>▾</span>
          </button>
          {tx.catOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30, width: 272, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 7, boxShadow: '0 12px 28px rgba(19,26,36,0.13)', padding: 6, animation: 'riseIn 120ms ease-out' }}>
              {catOptions.map((k) => {
                const on = tx.cats.includes(k);
                return (
                  <label key={k} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => setTx((t) => ({ ...t, cats: on ? t.cats.filter((x) => x !== k) : [...t.cats, k] }))} style={{ accentColor: '#2f5fd0' }} />
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <SevDot color={SEV_COLOR[getCategory(k).sev]} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCategory(k).label}</span>
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: '#9aa3b0' }}>{catCounts[k]}</span>
                  </label>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: `1px solid ${C.borderSoft}`, marginTop: 4, padding: '7px 8px 3px' }}>
                <button type="button" onClick={() => setTx((t) => ({ ...t, cats: [] }))} style={{ border: 0, background: 'none', padding: 0, fontSize: 11, color: ACCENT, cursor: 'pointer' }}>Clear</button>
                <button type="button" onClick={() => setTx((t) => ({ ...t, catOpen: false }))} style={{ border: 0, background: 'none', padding: 0, fontSize: 11, color: INK2, cursor: 'pointer' }}>Done</button>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#9aa3b0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</span>
          <SegGroup
            options={[
              { label: 'All', on: tx.type === 'all', onClick: () => setTx((t) => ({ ...t, type: 'all' })) },
              { label: 'Sales', on: tx.type === 'SALE', onClick: () => setTx((t) => ({ ...t, type: 'SALE' })) },
              { label: 'Refunds', on: tx.type === 'REFUND', onClick: () => setTx((t) => ({ ...t, type: 'REFUND' })) },
            ]}
          />
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <GhostButton onClick={exportCsv}>Export CSV</GhostButton>
        </div>
      </div>

      {/* No overflow container here: it would trap the sticky column header inside
          its own scroll box. */}
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '0 0 8px 8px', minWidth: 0 }}>
        {/* The design ships two separate tables with distinct names; keep them
            distinguishable to assistive tech even though we render one wrapper. */}
        <div
          ref={tableRef}
          role="table"
          aria-label={settleCentric ? 'Transactions by settlement' : 'Transactions by ledger transaction'}
          style={{ fontSize: 13 }}
        >
          {settleCentric ? (
            <>
              <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: GAP, padding: '9px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7b8697', position: 'sticky', top: 56, zIndex: 5 }}>
                <SortH label={L.id} k="id" tx={tx} setTx={setTx} colStyle={col('id')} />
                <SortH label={L.captured} k="captured" tx={tx} setTx={setTx} colStyle={col('captured')} />
                <SortH label={L.merchant} k="merchant" tx={tx} setTx={setTx} colStyle={col('merchant')} />
                <SortH label={L.ref} k="ref" tx={tx} setTx={setTx} colStyle={col('ref')} />
                <SortH label={L.sales} k="sales" tx={tx} setTx={setTx} colStyle={col('sales')} />
                <SortH label={L.refunds} k="refunds" tx={tx} setTx={setTx} colStyle={col('refunds')} />
                <SortH label={L.fees} k="fees" tx={tx} setTx={setTx} colStyle={col('fees')} />
                <SortH label={L.expected} k="expected" tx={tx} setTx={setTx} colStyle={col('expected')} />
                <SortH label={L.settled} k="settled" tx={tx} setTx={setTx} colStyle={col('settled')} />
                <SortH label={L.disc} k="disc" tx={tx} setTx={setTx} colStyle={col('disc')} />
                <SortH label={L.category} k="category" tx={tx} setTx={setTx} colStyle={col('category')} />
                <span role="columnheader" />
              </div>
              {settleRows.length === 0 && neverSettled.length === 0 && <div style={{ padding: '26px 16px', color: '#9aa3b0' }}>No settlements match.</div>}
              {settleRows.map((o) => {
                const idx = o.r.settlements.indexOf(o.x);
                const carrier = carrierOf[o.r.id] === idx + 1;
                const parts = o.r.settlements.length;
                // One string for every carried cell, as the design's `inheritTitle` does:
                // the ledger-side figures belong to the transaction, not to each payout.
                // Fees and Settled are the only money columns that are per-payout here.
                const inheritTitle = carrier
                  ? ''
                  : `Same ledger transaction — sales, refunds, expected pay and discrepancy are shown on part ${carrierOf[o.r.id]} of ${parts}`;
                // Carried cell: the figure on the carrier row, 〃 on every later part.
                const carried = (content, color) =>
                  cell(carrier ? content : '〃', { right: true, color: carrier ? color || INK : '#9aa3b0', title: inheritTitle });
                return renderRow(
                  o.x.ref,
                  COLS,
                  [
                    idCell(shortRefOf(o.x.ref), o.x.ref, 'Network ref'),
                    cell(o.x.date, { color: INK2, size: 12 }),
                    cell(o.x.merchantId, { color: INK2, size: 12 }),
                    cell(o.x.merchantRef || '—', { color: INK2, size: 12 }),
                    carried(saleOf(o.r) === null ? '—' : fmt(saleOf(o.r))),
                    carried(refundOf(o.r) === null ? '—' : fmt(refundOf(o.r)), refundOf(o.r) === null ? undefined : NEG),
                    cell(feesOf(o.x) === 0 ? '—' : fmt(feesOf(o.x)), { right: true, color: INK2 }),
                    carried(fmt(o.r.rowExpected)),
                    cell(fmt(o.x.settled), { right: true }),
                    cell(carrier ? sfmt(o.r.rowImpact) : '〃', { right: true, weight: carrier ? 500 : 400, color: carrier ? impCol(o.r.rowImpact) : '#9aa3b0', title: inheritTitle }),
                    catCell(o.r.category),
                    cell(expanded === o.x.ref ? '▴' : '▾', { right: true, color: '#9aa3b0', size: 11 }),
                  ],
                  o.r,
                  o.r.ledger ? <Subline text={o.r.ledger.id} label="Internal txn id" display={o.r.ledger.id} note={parts > 1 ? `part ${idx + 1} of ${parts}` : null} /> : null,
                );
              })}
              {split && totalRow('sub-settled', 'Subtotal', plural(settleRows.length, 'row'), totalsOf(sec1), false)}
              {neverSettled.length > 0 && (
                <SectionHeader labels={L} overrides={{ id: LABELS.ledger.id }} template={COLS} gap={GAP} col={col}>
                  Never settled — ledger transactions with no payout
                </SectionHeader>
              )}
              {neverSettled.map((r) =>
                renderRow(
                  r.id,
                  COLS,
                  [
                    // No network ref exists for this row, so the id column carries the
                    // ledger txn id — its only identifier — rather than a bare dash.
                    idCell(r.ledger.id, r.ledger.id, 'Identifier'),
                    cell('unsettled', { color: '#9aa3b0', sans: true, size: 12 }),
                    cell(r.merchantId, { color: INK2, size: 12 }),
                    cell(r.ledger.merchantRef || '—', { color: INK2, size: 12 }),
                    cell(saleOf(r) === null ? '—' : fmt(saleOf(r)), { right: true }),
                    cell(refundOf(r) === null ? '—' : fmt(refundOf(r)), { right: true, color: refundOf(r) === null ? undefined : NEG }),
                    // No payout, so no fees were ever deducted — expected pay is the gross.
                    cell('—', { right: true, color: '#9aa3b0' }),
                    cell(fmt(r.rowExpected), { right: true }),
                    cell('—', { right: true, color: '#9aa3b0' }),
                    cell(sfmt(r.rowImpact), { right: true, weight: 500, color: impCol(r.rowImpact) }),
                    catCell(r.category),
                    cell(expanded === r.id ? '▴' : '▾', { right: true, color: '#9aa3b0', size: 11 }),
                  ],
                  r,
                  // The txn id now sits in the id cell above, so a subline would repeat it.
                  null,
                ),
              )}
              {/* "rows", not "settlements": these are the ones with no payout at all. */}
              {split && totalRow('sub-never', 'Subtotal', plural(neverSettled.length, 'row'), totalsOf(sec2), false)}
            </>
          ) : (
            <>
              <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: GAP, padding: '9px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7b8697', position: 'sticky', top: 56, zIndex: 5 }}>
                <SortH label={L.id} k="id" tx={tx} setTx={setTx} colStyle={col('id')} />
                <SortH label={L.captured} k="captured" tx={tx} setTx={setTx} colStyle={col('captured')} />
                <SortH label={L.merchant} k="merchant" tx={tx} setTx={setTx} colStyle={col('merchant')} />
                <SortH label={L.ref} k="ref" tx={tx} setTx={setTx} colStyle={col('ref')} />
                <SortH label={L.sales} k="sales" tx={tx} setTx={setTx} colStyle={col('sales')} />
                <SortH label={L.refunds} k="refunds" tx={tx} setTx={setTx} colStyle={col('refunds')} />
                <SortH label={L.fees} k="fees" tx={tx} setTx={setTx} colStyle={col('fees')} />
                <SortH label={L.expected} k="expected" tx={tx} setTx={setTx} colStyle={col('expected')} />
                <SortH label={L.settled} k="settled" tx={tx} setTx={setTx} colStyle={col('settled')} />
                <SortH label={L.disc} k="disc" tx={tx} setTx={setTx} colStyle={col('disc')} />
                <SortH label={L.category} k="category" tx={tx} setTx={setTx} colStyle={col('category')} />
                <span role="columnheader" />
              </div>
              {ledgerRows.length === 0 && orphanRows.length === 0 && <div style={{ padding: '26px 16px', color: '#9aa3b0' }}>No transactions match.</div>}
              {ledgerRows.map(renderLedgerRow)}
              {split && totalRow('sub-ledger', 'Subtotal', plural(ledgerRows.length, 'row'), totalsOf(sec1), false)}
              {orphanRows.length > 0 && (
                <SectionHeader labels={L} overrides={{ id: LABELS.settlement.id }} template={COLS} gap={GAP} col={col}>
                  Unattributed settlements — no ledger side
                </SectionHeader>
              )}
              {orphanRows.map(renderLedgerRow)}
              {split && totalRow('sub-orphan', 'Subtotal', plural(orphanRows.length, 'row'), totalsOf(sec2), false)}
            </>
          )}

          {/* Separates the section subtotal from the report-wide total, which otherwise
              stack as one block, and re-states the columns at the point furthest from the
              sticky header. Default labels, no override: this total covers every row. */}
          {split && <SectionHeader labels={grandBandLabels} template={COLS} gap={GAP} col={col} />}
          {totalRow(
            'grand',
            'Grand total',
            grandCount,
            grand,
            true,
          )}
        </div>
        <div style={{ padding: '11px 16px', borderTop: `1px solid ${C.borderSoft}`, background: C.surfaceAlt, borderRadius: '0 0 8px 8px', fontSize: 11, color: tieOk ? '#9aa3b0' : NEG, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{tieNote}</span>
          <span style={{ color: '#9aa3b0', textWrap: 'pretty' }}>{footnote}</span>
        </div>
      </div>
    </section>
  );
}
