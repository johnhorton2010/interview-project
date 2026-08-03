import React, { useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { matchAll, refOf, figures, saleOf, refundOf, orderedCategories } from '../../domain/selectors.js';
import { getCategory, QUARANTINE } from '../../domain/categories.js';
import { fmt, sfmt, neg, dec, decNeg, shortRefOf, downloadCsv } from '../../domain/format.js';
import { C, MONO, SANS, INK, INK2, NEG, ACCENT, SEV_COLOR } from '../../styles/tokens.js';
import { useColumns } from '../../styles/columns.js';
import { useWindowedRows, useRowMetrics, rowHeight } from '../../hooks/useWindowedRows.js';
import { TABLE_INSET, bodyRow, headerRow, totalRow, totalLabel, rowRule, figureColor, discColor, deductionColor, labelColor } from '../../styles/table.js';
import { HoverRow, SevDot, GhostButton, useDismiss, SegGroup, copyText, FilterStrip } from '../common.jsx';
import { SortHeader, BandLabel, EmptyState, TableFooter, GlyphKey } from './TableParts.jsx';
import { transactionsHelp, BAND_HELP } from './columnHelp.js';
import { COL, EXPORT_COLUMNS, project } from './exportColumns.js';
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
const SectionHeader = ({ children, labels, overrides, help, template, gap, col }) => (
  <div style={{ padding: `8px ${TABLE_INSET}px`, background: C.bandBg, borderBottom: `1px solid ${C.borderSoft}`, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>
    {/* Optional: a band may carry only column labels, with no caption above them. */}
    {children && <div>{children}</div>}
    {labels && (
      // `data-col-labels` opts this line into useColumns' content measurement.
      <div data-col-labels style={{ display: 'grid', gridTemplateColumns: template, gap, marginTop: children ? 6 : 0, color: C.dim }}>
        {/* Order comes from LSPEC, not from the label map's key order, so the two
            can never desync — the same positional coupling renderRow relies on.
            `help` comes from the band's own map, never the header's: a band exists
            because one of its columns means something else inside it. */}
        {LSPEC.map(({ key }) => (
          <BandLabel key={key} help={help && help[key]} style={{ ...col(key), whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {(overrides && overrides[key]) || labels[key]}
          </BandLabel>
        ))}
      </div>
    )}
  </div>
);

// Subline under a transaction row, matching the design (mono, 11px, muted). When
// `disabled` it states an absence ("no settlement") — there is nothing to copy, so it
// renders as plain text rather than offering a copy affordance that cannot work. It is
// not dimmed for it: the phrase is a fact about the row, and reads at the subline's own
// weight like every id beside it.
//
// Deliberately one item. useColumns measures only [role="row"] cells, so nothing
// down here can widen the column it sits under — a second item just overflows into
// the next one. Anything that needs to sit beside a value belongs in the row.
const Subline = ({ text, label, display, onToggle, flash, disabled }) => (
  <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `0 ${TABLE_INSET}px 7px`, marginTop: -4, cursor: 'pointer', fontFamily: MONO, fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
    {disabled ? (
      <span>{display}</span>
    ) : (
      <button type="button" title={`Copy ${label.toLowerCase()}`} onClick={(e) => { e.stopPropagation(); copyText(text, label, flash); }} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'copy' }}>
        {display}
      </button>
    )}
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

const feesOf = (x) => (x.interchange || 0) + (x.processor || 0);

// ---- cells -----------------------------------------------------------------
//
// Every cell takes its column's style fragment and merges it last, so alignment and the
// R5 left pad come from LSPEC by position and a body cell can never drift out of step
// with the header row. The fragments arrive as one `colStyles` array rather than being
// looked up per cell: they are then stable objects, which is what lets the row components
// below stay memoized.

const cell = (key, colStyle, content, opts = {}) => (
  <span
    key={key}
    role="cell"
    title={opts.title}
    style={{
      textAlign: opts.right ? 'right' : 'left',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      color: opts.color || INK,
      fontFamily: opts.sans ? SANS : MONO,
      fontWeight: opts.weight,
      fontSize: opts.size,
      ...colStyle,
    }}
  >
    {content}
  </span>
);

/** Category cell: severity swatch plus the label in row ink (design lines 553, 656). */
const catCell = (key, colStyle, category) => {
  const meta = getCategory(category);
  return (
    <span key={key} role="cell" style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: SANS, minWidth: 0, ...colStyle }}>
      <SevDot color={SEV_COLOR[meta.sev]} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.label}</span>
    </span>
  );
};

/**
 * Identifier cell: click-to-copy, matching the design's `onCopyId` buttons, plus an
 * optional "which payout of how many" marker.
 *
 * The marker is a sibling of the button, not its content: it is not part of the ref,
 * and `copyText` must keep copying the bare identifier.
 *
 * It sizes nothing, so two rows in twenty do not widen this column for all of them —
 * `data-col-ignore` states that for the DOM-walking path in useColumns, and this tab's
 * candidate builder simply never offers it. In exchange it gets no reserved width, so the
 * cell drops `overflow: hidden` to let it use the gutter. That is bounded: even at the
 * slack floor the marker spills ~7px into a 16px gap, so it cannot reach the next column.
 * Cells without a marker keep the clip, and with it the ellipsis on long ids.
 */
const idCell = (key, colStyle, flash, display, text, label, part) => (
  <span key={key} role="cell" style={{ overflow: part ? 'visible' : 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...colStyle }}>
    <CopyButton text={text} label={label} display={display} flash={flash} />
    {part && (
      <span data-col-ignore style={{ marginLeft: 6, fontSize: 10, color: C.dim }} title={`Payout ${part} of this transaction`}>
        {part}
      </span>
    )}
  </span>
);

/**
 * The chrome every body row shares: hover tint, the grid row, the optional subline and
 * the expanded detail.
 *
 * Hover lives on the wrapper so the cells, the subline and the expanded detail all tint
 * together as one row (design lines 540/560, 643/663).
 */
function RowShell({ rowKey, rowIndex, shape, open, template, gap, cells, row, model, subline, flash, onToggle }) {
  const toggle = useCallback(() => onToggle(rowKey), [onToggle, rowKey]);
  return (
    // `data-row-shape` / `data-row-open` are what useRowMetrics measures. A row with a
    // subline is taller than one without, and windowing needs that height to be real
    // rather than assumed — see the hook.
    <HoverRow data-row-shape={shape} data-row-open={open || undefined} style={rowRule} hoverStyle={{ background: C.hover }}>
      <div role="row" aria-rowindex={rowIndex} aria-expanded={open} onClick={toggle} style={{ ...bodyRow(template, gap), background: open ? C.hover : 'transparent', alignItems: 'center' }}>
        {cells}
      </div>
      {subline && <Subline {...subline} onToggle={toggle} flash={flash} />}
      {open && row && <BreakDetail row={row} model={model} />}
    </HoverRow>
  );
}

/**
 * One ledger transaction — the ledger view's body row, and the unattributed-settlement
 * band's too.
 *
 * Memoized, along with the two below. A long table renders a window onto its rows and
 * re-slices that window as the page scrolls, so without this every row still on screen
 * would re-render on every scroll tick. `r` comes straight out of the model and the rest
 * of the props are held stable by the parent, so a re-render costs one identity check per
 * row that has not changed.
 */
const LedgerRow = React.memo(function LedgerRow({ r, rowIndex, open, template, gap, colStyles, model, flash, onToggle }) {
  // null, not 0, when nothing settled, matching BreaksTab: no fee or settlement data
  // exists, which is distinct from either being genuinely zero. Fees follow Settled —
  // a row with no payout was never charged, so both read as absent, not as zero. A row
  // folding several payouts into this sum is flagged by the subline's ref count and by
  // its category, so the figure itself carries no marker.
  const actual = r.settlements.length ? r.rowActual : null;
  const fees = r.settlements.length ? r.rowFees : null;
  const captured = r.ledger ? r.ledger.capturedAt : 'no ledger';
  const ref = r.ledger ? r.ledger.merchantRef || '—' : r.settlements[0].merchantRef || '—';
  const refs = r.settlements.map((x) => x.ref);
  const refDisplay = refs.length ? shortRefOf(refs[0]) + (refs.length > 1 ? ` +${refs.length - 1}` : '') : '';
  const c = colStyles;
  return (
    <RowShell
      rowKey={r.id}
      rowIndex={rowIndex}
      shape={r.ledger ? 'sub' : 'plain'}
      open={open}
      template={template}
      gap={gap}
      row={r}
      model={model}
      flash={flash}
      onToggle={onToggle}
      cells={[
        r.ledger
          ? idCell(0, c[0], flash, r.ledger.id, r.ledger.id, 'Identifier')
          : idCell(0, c[0], flash, shortRefOf(r.settlements[0].ref), r.settlements[0].ref, 'Network ref'),
        // 'no ledger' reads at full label weight, like the date it replaces. A dash is a
        // placeholder and recedes; a phrase is a statement of fact — here, the most
        // interesting thing on the row — so it is content and reads like content.
        cell(1, c[1], captured, { color: INK2, size: 12 }),
        cell(2, c[2], r.merchantId, { color: INK2, size: 12 }),
        cell(3, c[3], ref, { color: labelColor(ref), size: 12 }),
        cell(4, c[4], fmt(saleOf(r)), { right: true, color: figureColor(saleOf(r)) }),
        cell(5, c[5], neg(refundOf(r)), { right: true, color: deductionColor(refundOf(r)) }),
        cell(6, c[6], neg(fees), { right: true, color: deductionColor(fees) }),
        cell(7, c[7], fmt(r.rowExpected), { right: true, color: figureColor(r.rowExpected) }),
        cell(8, c[8], fmt(actual), { right: true, color: figureColor(actual) }),
        cell(9, c[9], sfmt(r.rowImpact), { right: true, weight: 500, color: discColor(r.rowImpact) }),
        catCell(10, c[10], r.category),
        cell(11, c[11], open ? '▴' : '▾', { right: true, color: C.dim, size: 11 }),
      ]}
      // Gated on the ledger side, not on refs (design: `hasRefSubline: !!r.ledger`).
      // An unattributed row already shows its network ref in the id cell, so a subline
      // there would repeat it verbatim; a row with a ledger side but no payout instead
      // states the absence.
      subline={
        r.ledger
          ? {
              text: refs.join(' '),
              label: refs.length > 1 ? 'Network refs' : 'Network ref',
              display: refs.length ? refDisplay : 'no settlement',
              disabled: !refs.length,
            }
          : null
      }
    />
  );
});

/** One processor settlement, with 〃 standing in for the figures its carrier row prints. */
const SettleRow = React.memo(function SettleRow({ o, carrierPart, rowIndex, open, template, gap, colStyles, model, flash, onToggle }) {
  const { r, x, part, parts } = o;
  const carrier = carrierPart === part;
  // One string for every carried cell, as the design's `inheritTitle` does: the
  // ledger-side figures belong to the transaction, not to each payout. Fees and Settled
  // are the only money columns that are per-payout here.
  const inheritTitle = carrier
    ? ''
    : `Same ledger transaction — sales, refunds, expected pay and discrepancy are shown on part ${carrierPart} of ${parts}`;
  const c = colStyles;
  // Carried cell: the figure on the carrier row, 〃 on every later part.
  const carried = (i, content, color) =>
    cell(i, c[i], carrier ? content : '〃', { right: true, color: carrier ? color || INK : C.dim, title: inheritTitle });
  return (
    <RowShell
      rowKey={x.ref}
      rowIndex={rowIndex}
      shape={r.ledger ? 'sub' : 'plain'}
      open={open}
      template={template}
      gap={gap}
      row={r}
      model={model}
      flash={flash}
      onToggle={onToggle}
      cells={[
        idCell(0, c[0], flash, shortRefOf(x.ref), x.ref, 'Network ref', parts > 1 ? `${part}/${parts}` : null),
        cell(1, c[1], x.date, { color: labelColor(x.date), size: 12 }),
        cell(2, c[2], x.merchantId, { color: INK2, size: 12 }),
        cell(3, c[3], x.merchantRef || '—', { color: labelColor(x.merchantRef), size: 12 }),
        carried(4, fmt(saleOf(r)), figureColor(saleOf(r))),
        carried(5, neg(refundOf(r)), deductionColor(refundOf(r))),
        // Fees are per-payout, so this cell is never carried — a settlement that deducted
        // nothing shows $0.00, not the dash that means "no data".
        cell(6, c[6], neg(feesOf(x)), { right: true, color: deductionColor(feesOf(x)) }),
        carried(7, fmt(r.rowExpected), figureColor(r.rowExpected)),
        cell(8, c[8], fmt(x.settled), { right: true, color: figureColor(x.settled) }),
        cell(9, c[9], carrier ? sfmt(r.rowImpact) : '〃', { right: true, weight: carrier ? 500 : 400, color: carrier ? discColor(r.rowImpact) : C.dim, title: inheritTitle }),
        catCell(10, c[10], r.category),
        cell(11, c[11], open ? '▴' : '▾', { right: true, color: C.dim, size: 11 }),
      ]}
      subline={r.ledger ? { text: r.ledger.id, label: 'Internal txn id', display: r.ledger.id } : null}
    />
  );
});

/** A ledger transaction the processor never paid out — the settlement view's second band. */
const NeverSettledRow = React.memo(function NeverSettledRow({ r, rowIndex, open, template, gap, colStyles, model, flash, onToggle }) {
  const c = colStyles;
  return (
    <RowShell
      rowKey={r.id}
      rowIndex={rowIndex}
      shape="plain"
      open={open}
      template={template}
      gap={gap}
      row={r}
      model={model}
      flash={flash}
      onToggle={onToggle}
      cells={[
        // No network ref exists for this row, so the id column carries the ledger txn id —
        // its only identifier — rather than a bare dash.
        idCell(0, c[0], flash, r.ledger.id, r.ledger.id, 'Identifier'),
        cell(1, c[1], 'unsettled', { color: INK2, sans: true, size: 12 }),
        cell(2, c[2], r.merchantId, { color: INK2, size: 12 }),
        cell(3, c[3], r.ledger.merchantRef || '—', { color: labelColor(r.ledger.merchantRef), size: 12 }),
        cell(4, c[4], fmt(saleOf(r)), { right: true, color: figureColor(saleOf(r)) }),
        cell(5, c[5], neg(refundOf(r)), { right: true, color: deductionColor(refundOf(r)) }),
        // No payout, so no fees were ever deducted and nothing was settled. Both read as
        // absent rather than zero — expected pay is the gross.
        cell(6, c[6], neg(null), { right: true, color: deductionColor(null) }),
        cell(7, c[7], fmt(r.rowExpected), { right: true, color: figureColor(r.rowExpected) }),
        cell(8, c[8], fmt(null), { right: true, color: figureColor(null) }),
        cell(9, c[9], sfmt(r.rowImpact), { right: true, weight: 500, color: discColor(r.rowImpact) }),
        catCell(10, c[10], r.category),
        cell(11, c[11], open ? '▴' : '▾', { right: true, color: C.dim, size: 11 }),
      ]}
      // The txn id now sits in the id cell above, so a subline would repeat it.
      subline={null}
    />
  );
});

const zeroTotals = () => ({ sales: 0, refunds: 0, fees: 0, expected: 0, settled: 0, impact: 0 });

// Positions in LSPEC that hold money. Used when sizing columns, where a money column is
// fitted to the largest magnitude it prints rather than to the longest string it holds.
const MONEY_COLS = new Set([4, 5, 6, 7, 8, 9]);

// Shared empties for the view that is not on screen, so switching views does not hand the
// inactive branch a fresh array identity every render.
const EMPTY_LEDGER = { rows: [], orphans: [] };
const EMPTY_SETTLE = { rows: [], carrierOf: {}, neverSettled: [] };

function SortH({ label, k, tx, setTx, colStyle, help }) {
  const onClick = () => setTx((t) => (t.sortKey === k ? { ...t, sortKey: k, sortDir: t.sortDir === 'asc' ? 'desc' : 'asc' } : { ...t, sortKey: k, sortDir: NATURAL[k] }));
  return (
    <SortHeader
      label={label}
      help={help[k]}
      active={tx.sortKey === k}
      dir={tx.sortDir}
      onClick={onClick}
      style={colStyle}
    />
  );
}

export default function TransactionsTab({ model, tx, setTx, expanded, setExpanded, flash }) {
  const catMenuRef = useDismiss(tx.catOpen, () => setTx((t) => ({ ...t, catOpen: false })));
  const tableRef = useRef(null);
  const f = figures(model);
  const settleCentric = tx.view === 'settlement';
  const L = LABELS[settleCentric ? 'settlement' : 'ledger'];
  // Six of these swap with the view — see columnHelp.js.
  const HELP = transactionsHelp(settleCentric);

  // The input stays synchronous; the filter behind it is allowed to lag a frame. Every
  // keystroke re-filters, re-sorts and re-renders the whole table, which is more work
  // than a keypress can afford to block on once the dataset is large.
  const query = useDeferredValue(tx.query);

  const txVisible = useMemo(
    () =>
      model.included.filter((r) => {
        if (tx.cats.length && !tx.cats.includes(r.category)) return false;
        if (tx.type !== 'all' && (!r.ledger || r.ledger.type !== tx.type)) return false;
        return matchAll(r, query);
      }),
    [model, tx.cats, tx.type, query],
  );

  const catCounts = useMemo(() => {
    const counts = {};
    model.included.forEach((r) => (counts[r.category] = (counts[r.category] || 0) + 1));
    return counts;
  }, [model]);

  // Every category this tab can show, whether or not the dataset produced it — the same
  // rule the Summary rows follow. QUARANTINE is the one exclusion: those records are on
  // their own tab and never in `included`, so the checkbox could only ever match nothing.
  const catOptions = useMemo(
    () => orderedCategories([...model.included.map((r) => r.category), ...tx.cats], (k) => k !== QUARANTINE),
    [model, tx.cats],
  );

  // ---- ledger view rows
  // Each view builds only its own rows: the inactive one returns EMPTY rather than sorting
  // a set nothing will render.
  const ledger = useMemo(() => {
    if (settleCentric) return EMPTY_LEDGER;
    const flip = tx.sortDir === 'asc' ? 1 : -1;
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
    return {
      rows: txVisible.filter((r) => r.ledger).slice().sort((a, b) => lBase(a, b) * flip || a.id.localeCompare(b.id)),
      orphans: txVisible.filter((r) => !r.ledger),
    };
  }, [settleCentric, txVisible, tx.sortKey, tx.sortDir]);
  const { rows: ledgerRows, orphans: orphanRows } = ledger;

  // ---- settlement view rows (grouped, contiguous parts, 〃 for carried figures)
  const settle = useMemo(() => {
    if (!settleCentric) return EMPTY_SETTLE;
    const flip = tx.sortDir === 'asc' ? 1 : -1;
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
    txVisible.forEach((r) => {
      const parts = r.settlements.length;
      r.settlements.forEach((x, i) => {
        let g = groupMap.get(r.id);
        if (!g) groupMap.set(r.id, (g = []));
        // `part` is stamped here, at the one point the settlement's position in its
        // transaction is already known. It used to be recovered later with
        // `settlements.indexOf(x)` — a linear scan re-run per rendered row and per
        // exported row, for an index this loop is holding.
        g.push({ r, x, part: i + 1, parts });
      });
    });
    const groups = [...groupMap.values()];
    groups.forEach((g) => g.sort(sCmp));
    groups.sort((a, b) => sCmp(a[0], b[0]));
    // Groups are keyed by row id and stay contiguous, so the carrier is simply whichever
    // part sorted to the front of its own group.
    const carrierOf = {};
    groups.forEach((g) => (carrierOf[g[0].r.id] = g[0].part));
    return {
      rows: groups.flat(),
      carrierOf,
      neverSettled: txVisible.filter((r) => r.ledger && r.settlements.length === 0),
    };
  }, [settleCentric, txVisible, tx.sortKey, tx.sortDir]);
  const { rows: settleRows, carrierOf, neverSettled } = settle;

  // ---- totals
  // Always reduce over distinct ReconRows, never over rendered rows: in settlement view
  // one transaction spans several rows, and its ledger-side figures belong to the
  // transaction (hence the 〃 on later parts), so per-row sums would double-count them.
  //
  // The two bands partition txVisible in both views, so one pass yields both subtotals and
  // the grand total is their sum. This was six reduce passes per band, run three times.
  const totals = useMemo(() => {
    const inBand1 = settleCentric ? (r) => r.settlements.length > 0 : (r) => !!r.ledger;
    const t1 = zeroTotals();
    const t2 = zeroTotals();
    let n1 = 0;
    let n2 = 0;
    txVisible.forEach((r) => {
      const t = inBand1(r) ? ((n1 += 1), t1) : ((n2 += 1), t2);
      t.sales += saleOf(r) || 0;
      t.refunds += refundOf(r) || 0;
      t.fees += r.rowFees;
      t.expected += r.rowExpected;
      t.settled += r.rowActual;
      t.impact += r.rowImpact;
    });
    const grand = zeroTotals();
    Object.keys(grand).forEach((k) => (grand[k] = t1[k] + t2[k]));
    return { t1, t2, n1, n2, grand };
  }, [settleCentric, txVisible]);

  // Only worth splitting out subtotals when both bands actually have rows — otherwise a
  // subtotal just restates the grand total sitting directly beneath it.
  const split = totals.n1 > 0 && totals.n2 > 0;

  // Both views count what they put on screen, in the same unit: ledger renders one row per
  // ReconRow, settlement one per settlement plus one per never-settled transaction. Counting
  // settlements in one view and rows in the other made the two incomparable, and left the
  // settlement ladder unable to add up.
  const visibleRowCount = settleCentric ? settleRows.length + neverSettled.length : txVisible.length;

  const grand = totals.grand;
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
  // The key below states what 〃 means; this says which figures it carries and why they
  // are counted once, which is more than a key can hold.
  const footnote = settleCentric
    ? 'Sales, refunds, expected pay and discrepancy belong to the transaction, not to each payout, so a transaction that settled in parts prints them once.'
    : '';

  const exportCsv = () => {
    let n;
    if (settleCentric) {
      const cols = EXPORT_COLUMNS.transactionsSettlement;
      const rows = settleRows
        .map((o) => {
          const { part, parts } = o;
          // The ledger-side figures belong to the transaction, so only the line the table
          // prints them on carries them; the rest read 〃 on screen and blank here.
          const carrier = carrierOf[o.r.id] === part;
          const carried = (v) => (carrier ? v : '');
          return project(cols, {
            [COL.networkRef]: o.x.ref,
            [COL.part]: parts > 1 ? `${part}/${parts}` : '',
            [COL.txnId]: o.r.ledger ? o.r.ledger.id : '',
            [COL.capturedOn]: o.r.ledger ? o.r.ledger.capturedAt : '',
            [COL.settledOn]: o.x.date,
            [COL.merchant]: o.x.merchantId,
            [COL.merchantRef]: o.x.merchantRef || '',
            [COL.sales]: carried(dec(saleOf(o.r))),
            [COL.refunds]: carried(decNeg(refundOf(o.r))),
            // Fees and Settled are per-payout, so they are never carried.
            [COL.fees]: decNeg(feesOf(o.x)),
            [COL.expected]: carried(dec(o.r.rowExpected)),
            [COL.settled]: dec(o.x.settled),
            [COL.discrepancy]: carried(dec(o.r.rowImpact)),
            [COL.category]: getCategory(o.r.category).label,
            [COL.severity]: getCategory(o.r.category).sev,
          });
        })
        .concat(
          neverSettled.map((r) =>
            project(cols, {
              [COL.txnId]: r.ledger.id,
              [COL.capturedOn]: r.ledger.capturedAt,
              [COL.merchant]: r.merchantId,
              [COL.merchantRef]: r.ledger.merchantRef || '',
              [COL.sales]: dec(saleOf(r)),
              [COL.refunds]: decNeg(refundOf(r)),
              [COL.expected]: dec(r.rowExpected),
              [COL.discrepancy]: dec(r.rowImpact),
              [COL.category]: getCategory(r.category).label,
              [COL.severity]: getCategory(r.category).sev,
            }),
          ),
        );
      n = downloadCsv('transactions-by-settlement.csv', cols, rows);
    } else {
      const cols = EXPORT_COLUMNS.transactionsLedger;
      // `ledgerRows.concat(orphanRows)` rather than `txVisible`: the same set, but in the
      // order the table renders it, so the file follows the active sort.
      n = downloadCsv(
        'transactions.csv',
        cols,
        ledgerRows.concat(orphanRows).map((r) =>
          project(cols, {
            [COL.txnId]: r.ledger ? r.ledger.id : '',
            // The only file that folds several refs into a cell — one row per transaction.
            [COL.networkRef]: r.settlements.map((x) => x.ref).join(' '),
            [COL.capturedOn]: r.ledger ? r.ledger.capturedAt : '',
            [COL.settledOn]: r.settlements.length ? r.date : '',
            [COL.merchant]: r.merchantId,
            [COL.merchantRef]: r.ledger ? r.ledger.merchantRef || '' : r.settlements[0].merchantRef || '',
            [COL.sales]: dec(saleOf(r)),
            [COL.refunds]: decNeg(refundOf(r)),
            [COL.fees]: decNeg(r.rowFees),
            [COL.expected]: dec(r.rowExpected),
            [COL.settled]: r.settlements.length ? dec(r.rowActual) : '',
            [COL.discrepancy]: dec(r.rowImpact),
            [COL.category]: getCategory(r.category).label,
            [COL.severity]: getCategory(r.category).sev,
          }),
        ),
      );
    }
    flash(`${settleCentric ? 'transactions-by-settlement.csv' : 'transactions.csv'} — ${n} rows exported`);
  };

  const catLabel = tx.cats.length === 0 ? 'All categories' : tx.cats.length === 1 ? getCategory(tx.cats[0]).label : `${tx.cats.length} categories`;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const grandCount = plural(visibleRowCount, 'row');

  // Ordered to parallel the Breaks strip: category, the tab-specific filter, then search.
  // `view` and sort are view modes, not filters, so neither is listed nor cleared.
  const filterBits = [];
  if (tx.cats.length) filterBits.push('category: ' + tx.cats.map((k) => getCategory(k).label).join(', '));
  if (tx.type !== 'all') filterBits.push('type: ' + (tx.type === 'SALE' ? 'Sales' : 'Refunds'));
  if (query.trim()) filterBits.push('search: "' + query.trim() + '"');

  // The band above the grand total names only the columns that row fills. The cells it
  // leaves empty are blanked rather than labelled, and `ref` is renamed: it holds the row
  // count, not a merchant ref. "Count" rather than "Rows" so the header does not repeat
  // the noun already in the value ("18 rows").
  const grandBandLabels = { ...L, id: '', captured: '', merchant: '', ref: 'Count', category: '' };

  // ---- column sizing
  //
  // The widest string each column's body will have to print, declared for useColumns
  // rather than left to be walked off the DOM — see the header of styles/columns.js for
  // why a long table cannot be sized by whichever rows happen to be rendered.
  //
  // One pass over the rendered rows, with no formatting inside the loop: money is tracked
  // as a magnitude and formatted once at the end. That is sound because the money columns
  // are tabular-nums mono, so width follows digit count and digit count follows magnitude.
  // The text columns are mono too, so the longest string is the widest one. `category` is
  // the one proportional exception, and its vocabulary is ten fixed labels, so choosing by
  // length is at worst a glyph or two out — comfortably inside the slack floor.
  const candidates = useMemo(() => {
    const text = new Array(LSPEC.length).fill('');
    // Two magnitudes per money column: the widest that prints bare, and the widest that
    // prints behind a sign. Keeping them apart is what stops a column reserving room for
    // a minus that only ever appears on a smaller figure — one glyph, but a visible one.
    const bare = new Array(LSPEC.length).fill(-1);
    const signed = new Array(LSPEC.length).fill(-1);

    const t = (i, s) => {
      if (s && s.length > text[i].length) text[i] = s;
    };
    const widen = (arr, i, v) => {
      if (v > arr[i]) arr[i] = v;
    };
    /** Sales, Exp pay, Settled: `fmt` signs only a negative. */
    const m = (i, v) => {
      if (v === null || v === undefined) return;
      widen(v < 0 ? signed : bare, i, Math.abs(v));
    };
    /** Refunds and Fees print through `neg`, which signs every non-zero value however it
     *  is stored; Discrepancy prints through `sfmt`, which signs a positive too. Either
     *  way a zero prints bare as $0.00. */
    const mNeg = (i, v) => {
      if (v === null || v === undefined) return;
      widen(v ? signed : bare, i, Math.abs(v));
    };
    // The four ledger-side figures, identical in both views.
    const txnMoney = (r) => {
      m(4, saleOf(r));
      mNeg(5, refundOf(r));
      m(7, r.rowExpected);
      mNeg(9, r.rowImpact);
    };
    const txnText = (r, id, captured, ref) => {
      t(0, id);
      t(1, captured);
      t(2, r.merchantId);
      t(3, ref || '');
      t(10, getCategory(r.category).label);
    };

    if (settleCentric) {
      settleRows.forEach((o) => {
        txnText(o.r, shortRefOf(o.x.ref), o.x.date, o.x.merchantRef);
        // The id cell of a multi-part settlement also carries a "2/3" marker, but that
        // is `data-col-ignore` decoration and deliberately sizes nothing — under this
        // path it is excluded simply by never being offered as a candidate.
        txnMoney(o.r);
        mNeg(6, feesOf(o.x));
        m(8, o.x.settled);
      });
      neverSettled.forEach((r) => {
        txnText(r, r.ledger.id, 'unsettled', r.ledger.merchantRef);
        txnMoney(r);
      });
    } else {
      const ledgerRow = (r) => {
        txnText(
          r,
          r.ledger ? r.ledger.id : shortRefOf(r.settlements[0].ref),
          r.ledger ? r.ledger.capturedAt : 'no ledger',
          r.ledger ? r.ledger.merchantRef : r.settlements[0].merchantRef,
        );
        txnMoney(r);
        // A row with no payout prints '—' in both, which is narrower than any figure.
        if (r.settlements.length) {
          mNeg(6, r.rowFees);
          m(8, r.rowActual);
        }
      };
      ledgerRows.forEach(ledgerRow);
      orphanRows.forEach(ledgerRow);
    }

    // The summary rows are sized here too. The DOM walk used to catch them for free, and
    // they carry the largest figures in the table — a column fitted only to its body rows
    // clips the grand total.
    t(0, 'Grand total');
    t(3, grandCount);
    if (split) {
      t(0, 'Subtotal');
      t(3, plural(settleCentric ? settleRows.length : ledgerRows.length, 'row'));
      t(3, plural(settleCentric ? neverSettled.length : orphanRows.length, 'row'));
    }
    [totals.grand, totals.t1, totals.t2].forEach((s) => {
      m(4, s.sales);
      mNeg(5, s.refunds);
      mNeg(6, s.fees);
      m(7, s.expected);
      m(8, s.settled);
      mNeg(9, s.impact);
    });
    t(11, '▾');

    return LSPEC.map((c, i) => {
      if (!MONEY_COLS.has(i)) return text[i];
      const a = bare[i] < 0 ? '' : fmt(bare[i]);
      const b = signed[i] < 0 ? '' : '−' + fmt(signed[i]);
      return b.length > a.length ? b : a;
    });
  }, [settleCentric, ledgerRows, orphanRows, settleRows, neverSettled, totals, split, grandCount]);

  // `fontKey` is the view: it is the only thing that changes a column's font here — the
  // settlement view's "unsettled" cell is sans where the ledger view's date is mono.
  const { template: COLS, gap: GAP, cell: col, cells: colStyles } = useColumns(tableRef, LSPEC, {
    candidates,
    fontKey: tx.view,
  });

  // One callback for every row, rather than a closure per row: a fresh handler per row
  // would change on every render and defeat the memo on the row components.
  const onToggle = useCallback((k) => setExpanded((p) => (p === k ? null : k)), [setExpanded]);

  // The props every body row shares, gathered once so each row takes one stable object's
  // worth of identity checks rather than eight fresh values.
  const rowProps = { template: COLS, gap: GAP, colStyles, model, flash, onToggle };

  // ---- windowing
  //
  // Both bands of the active view are windowed, each with its own hook instance: they are
  // separated by a section header and by a subtotal, so they scroll as two runs of rows
  // rather than one, and each needs its own document offset.
  const H = useRowMetrics(tableRef, `${tx.view}|${expanded}|${COLS}`);
  const band1Ref = useRef(null);
  const band2Ref = useRef(null);

  // At most one row is ever expanded — App holds a single key — so no per-row measurement
  // cache is needed: the open row is the only one taller than its neighbours.
  //
  // The subline is the only other thing that varies, and it is the shape each row already
  // declares to useRowMetrics. Every row of the ledger band carries one (the band is
  // `txVisible.filter(r => r.ledger)` and the subline is gated on exactly that); a
  // settlement row carries one only when its transaction has a ledger side; neither
  // trailing band carries any.
  const metricSig = JSON.stringify(H);

  const band1Rows = settleCentric ? settleRows : ledgerRows;
  const band1 = useWindowedRows({
    count: band1Rows.length,
    heightOf: useCallback(
      (i) => {
        const o = band1Rows[i];
        return settleCentric
          ? rowHeight(H, o.r.ledger ? 'sub' : 'plain', o.x.ref === expanded)
          : rowHeight(H, 'sub', o.id === expanded);
      },
      [band1Rows, settleCentric, expanded, H],
    ),
    sig: `${tx.view}|1|${band1Rows.length}|${expanded}|${metricSig}`,
    ref: band1Ref,
  });
  const band1Slice = band1Rows.slice(band1.start, band1.end);

  const band2Rows = settleCentric ? neverSettled : orphanRows;
  const band2 = useWindowedRows({
    count: band2Rows.length,
    heightOf: useCallback(
      (i) => rowHeight(H, 'plain', band2Rows[i].id === expanded),
      [band2Rows, expanded, H],
    ),
    sig: `${tx.view}|2|${band2Rows.length}|${expanded}|${metricSig}`,
    ref: band2Ref,
  });
  const band2Slice = band2Rows.slice(band2.start, band2.end);

  /**
   * Summary row over the measure columns, positionally matched to LSPEC like the body
   * rows. `strong` marks the grand total: it keeps the firm rule the single Total row
   * always had, while the subtotals sit under a softer one so the three read as a
   * hierarchy rather than three equal rows.
   */
  const summaryRow = (key, label, count, t, strong) => (
    <div key={key} role="row" style={totalRow(COLS, GAP, strong)}>
      <span role="cell" style={{ ...totalLabel, fontWeight: strong ? 600 : 400 }}>{label}</span>
      <span /><span />
      {/* Merchant ref is the last text column before the measure block, so the count
          goes there in both views — it is the only slot left that is not money. */}
      <span role="cell" style={{ ...totalLabel, color: INK2 }}>{count}</span>
      <span role="cell" style={{ textAlign: 'right', color: figureColor(t.sales) }}>{fmt(t.sales)}</span>
      <span role="cell" style={{ textAlign: 'right', color: deductionColor(t.refunds) }}>{neg(t.refunds)}</span>
      <span role="cell" style={{ textAlign: 'right', color: deductionColor(t.fees) }}>{neg(t.fees)}</span>
      <span role="cell" style={{ textAlign: 'right', color: figureColor(t.expected) }}>{fmt(t.expected)}</span>
      <span role="cell" style={{ textAlign: 'right', color: figureColor(t.settled) }}>{fmt(t.settled)}</span>
      <span role="cell" style={{ textAlign: 'right', color: discColor(t.impact) }}>{sfmt(t.impact)}</span>
      <span /><span />
    </div>
  );

  return (
    <section>
      {/* header + toolbar */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px 8px 0 0', borderBottom: 0, padding: '14px 18px' }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Transactions</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
          Click a row to expand the full transaction detail.
        </p>
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <input type="search" value={tx.query} onChange={(e) => setTx((t) => ({ ...t, query: e.target.value }))} placeholder="Search id, merchant, ref, amount, or date — e.g. captured:2026-06-01..2026-06-05" title={SEARCH_TITLE} style={{ flex: 1, minWidth: 220, padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, color: INK }} />
          <SearchHelp
            open={tx.helpOpen}
            onToggle={() => setTx((t) => ({ ...t, helpOpen: !t.helpOpen }))}
            onClose={() => setTx((t) => ({ ...t, helpOpen: false }))}
            align="left"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>View</span>
            <SegGroup
              options={[
                { label: 'Ledger', on: !settleCentric, title: 'One row per internal ledger transaction', onClick: () => setTx((t) => ({ ...t, view: 'ledger' })) },
                { label: 'Settlement', on: settleCentric, title: 'One row per processor settlement', onClick: () => setTx((t) => ({ ...t, view: 'settlement' })) },
              ]}
            />
          </div>
          <div ref={catMenuRef} style={{ position: 'relative' }}>
            <button type="button" aria-expanded={tx.catOpen} onClick={() => setTx((t) => ({ ...t, catOpen: !t.catOpen }))} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${tx.cats.length ? '#bcd0f5' : C.border}`, background: tx.cats.length ? '#eaf0fd' : C.surface, color: tx.cats.length ? ACCENT : INK2, padding: '6px 10px', fontSize: 12, borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <span>{catLabel}</span>
              <span aria-hidden="true" style={{ color: C.dim, fontSize: 10 }}>▾</span>
            </button>
            {tx.catOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30, width: 272, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, boxShadow: '0 12px 28px rgba(19,26,36,0.13)', padding: 6, animation: 'riseIn 120ms ease-out' }}>
                {catOptions.map((k) => {
                  const on = tx.cats.includes(k);
                  return (
                    <label key={k} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={on} onChange={() => setTx((t) => ({ ...t, cats: on ? t.cats.filter((x) => x !== k) : [...t.cats, k] }))} style={{ accentColor: '#2f5fd0' }} />
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <SevDot color={SEV_COLOR[getCategory(k).sev]} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCategory(k).label}</span>
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>{catCounts[k] || 0}</span>
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
            <span style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</span>
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
      </div>

      <FilterStrip bits={filterBits} onClear={() => setTx((t) => ({ ...t, cats: [], type: 'all', query: '' }))} />

      {/* No overflow container here: it would trap the sticky column header inside
          its own scroll box. */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '0 0 8px 8px', minWidth: 0 }}>
        {/* The design ships two separate tables with distinct names; keep them
            distinguishable to assistive tech even though we render one wrapper. */}
        {/* `aria-rowcount` is the whole table, not the rendered slice: a windowed band
            has only its visible rows in the DOM, and without this a screen reader would
            be told the table is fifty rows long. Header row included, hence the +1. */}
        <div
          ref={tableRef}
          role="table"
          aria-label={settleCentric ? 'Transactions by settlement' : 'Transactions by ledger transaction'}
          aria-rowcount={visibleRowCount + 1}
          style={{ fontSize: 13 }}
        >
          {settleCentric ? (
            <>
              <div role="row" aria-rowindex={1} style={headerRow(COLS, GAP, true)}>
                <SortH label={L.id} k="id" tx={tx} setTx={setTx} help={HELP} colStyle={col('id')} />
                <SortH label={L.captured} k="captured" tx={tx} setTx={setTx} help={HELP} colStyle={col('captured')} />
                <SortH label={L.merchant} k="merchant" tx={tx} setTx={setTx} help={HELP} colStyle={col('merchant')} />
                <SortH label={L.ref} k="ref" tx={tx} setTx={setTx} help={HELP} colStyle={col('ref')} />
                <SortH label={L.sales} k="sales" tx={tx} setTx={setTx} help={HELP} colStyle={col('sales')} />
                <SortH label={L.refunds} k="refunds" tx={tx} setTx={setTx} help={HELP} colStyle={col('refunds')} />
                <SortH label={L.fees} k="fees" tx={tx} setTx={setTx} help={HELP} colStyle={col('fees')} />
                <SortH label={L.expected} k="expected" tx={tx} setTx={setTx} help={HELP} colStyle={col('expected')} />
                <SortH label={L.settled} k="settled" tx={tx} setTx={setTx} help={HELP} colStyle={col('settled')} />
                <SortH label={L.disc} k="disc" tx={tx} setTx={setTx} help={HELP} colStyle={col('disc')} />
                <SortH label={L.category} k="category" tx={tx} setTx={setTx} help={HELP} colStyle={col('category')} />
                <span role="columnheader" />
              </div>
              {settleRows.length === 0 && neverSettled.length === 0 && <EmptyState>No settlements match.</EmptyState>}
              {/* Stands in for the rows above the window, and marks the band's top for
                  the scroll geometry. Rendered even at zero height so the ref always has
                  an element and the DOM shape does not change with the row count. */}
              <div ref={band1Ref} aria-hidden="true" style={{ height: band1.padTop }} />
              {band1Slice.map((o, i) => (
                <SettleRow
                  key={o.x.ref}
                  o={o}
                  carrierPart={carrierOf[o.r.id]}
                  rowIndex={band1.start + i + 2}
                  open={expanded === o.x.ref}
                  {...rowProps}
                />
              ))}
              {band1.padBottom > 0 && <div aria-hidden="true" style={{ height: band1.padBottom }} />}
              {split && summaryRow('sub-settled', 'Subtotal', plural(settleRows.length, 'row'), totals.t1, false)}
              {neverSettled.length > 0 && (
                <SectionHeader labels={L} overrides={{ id: LABELS.ledger.id }} help={BAND_HELP.neverSettled} template={COLS} gap={GAP} col={col}>
                  Never settled — ledger transactions with no payout
                </SectionHeader>
              )}
              <div ref={band2Ref} aria-hidden="true" style={{ height: band2.padTop }} />
              {band2Slice.map((r, i) => (
                <NeverSettledRow key={r.id} r={r} rowIndex={settleRows.length + band2.start + i + 2} open={expanded === r.id} {...rowProps} />
              ))}
              {band2.padBottom > 0 && <div aria-hidden="true" style={{ height: band2.padBottom }} />}
              {/* "rows", not "settlements": these are the ones with no payout at all. */}
              {split && summaryRow('sub-never', 'Subtotal', plural(neverSettled.length, 'row'), totals.t2, false)}
            </>
          ) : (
            <>
              <div role="row" aria-rowindex={1} style={headerRow(COLS, GAP, true)}>
                <SortH label={L.id} k="id" tx={tx} setTx={setTx} help={HELP} colStyle={col('id')} />
                <SortH label={L.captured} k="captured" tx={tx} setTx={setTx} help={HELP} colStyle={col('captured')} />
                <SortH label={L.merchant} k="merchant" tx={tx} setTx={setTx} help={HELP} colStyle={col('merchant')} />
                <SortH label={L.ref} k="ref" tx={tx} setTx={setTx} help={HELP} colStyle={col('ref')} />
                <SortH label={L.sales} k="sales" tx={tx} setTx={setTx} help={HELP} colStyle={col('sales')} />
                <SortH label={L.refunds} k="refunds" tx={tx} setTx={setTx} help={HELP} colStyle={col('refunds')} />
                <SortH label={L.fees} k="fees" tx={tx} setTx={setTx} help={HELP} colStyle={col('fees')} />
                <SortH label={L.expected} k="expected" tx={tx} setTx={setTx} help={HELP} colStyle={col('expected')} />
                <SortH label={L.settled} k="settled" tx={tx} setTx={setTx} help={HELP} colStyle={col('settled')} />
                <SortH label={L.disc} k="disc" tx={tx} setTx={setTx} help={HELP} colStyle={col('disc')} />
                <SortH label={L.category} k="category" tx={tx} setTx={setTx} help={HELP} colStyle={col('category')} />
                <span role="columnheader" />
              </div>
              {ledgerRows.length === 0 && orphanRows.length === 0 && <EmptyState>No transactions match.</EmptyState>}
              {/* See the settlement band above: leading spacer doubles as the band's
                  position marker. */}
              <div ref={band1Ref} aria-hidden="true" style={{ height: band1.padTop }} />
              {band1Slice.map((r, i) => (
                <LedgerRow key={r.id} r={r} rowIndex={band1.start + i + 2} open={expanded === r.id} {...rowProps} />
              ))}
              {band1.padBottom > 0 && <div aria-hidden="true" style={{ height: band1.padBottom }} />}
              {split && summaryRow('sub-ledger', 'Subtotal', plural(ledgerRows.length, 'row'), totals.t1, false)}
              {orphanRows.length > 0 && (
                <SectionHeader labels={L} overrides={{ id: LABELS.settlement.id }} help={BAND_HELP.unattributed} template={COLS} gap={GAP} col={col}>
                  Unmatched Settlements
                </SectionHeader>
              )}
              <div ref={band2Ref} aria-hidden="true" style={{ height: band2.padTop }} />
              {band2Slice.map((r, i) => (
                <LedgerRow key={r.id} r={r} rowIndex={ledgerRows.length + band2.start + i + 2} open={expanded === r.id} {...rowProps} />
              ))}
              {band2.padBottom > 0 && <div aria-hidden="true" style={{ height: band2.padBottom }} />}
              {split && summaryRow('sub-orphan', 'Subtotal', plural(orphanRows.length, 'row'), totals.t2, false)}
            </>
          )}

          {/* Separates the section subtotal from the report-wide total, which otherwise
              stack as one block, and re-states the columns at the point furthest from the
              sticky header. Default labels, no override: this total covers every row. */}
          {split && <SectionHeader labels={grandBandLabels} help={BAND_HELP.grand(settleCentric)} template={COLS} gap={GAP} col={col} />}
          {summaryRow(
            'grand',
            'Grand total',
            grandCount,
            grand,
            true,
          )}
        </div>
        {/* The tie-out note is the one piece of chrome that turns red: it does so when the
            visible impact stops matching the headline discrepancy, which is a report bug. */}
        {/* 〃 is listed in both views though only settlement can produce one: the key
            describes the tab, so toggling View does not shift the footer under you. */}
        <TableFooter
          style={{ borderRadius: '0 0 8px 8px', ...(tieOk ? null : { color: NEG }) }}
          left={tieNote}
          right={<span style={{ color: C.dim, textWrap: 'pretty' }}>{footnote}</span>}
          legend={<GlyphKey keys={['dash', 'zero', 'ditto']} />}
        />
      </div>
    </section>
  );
}
