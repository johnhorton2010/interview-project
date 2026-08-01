import React, { useRef } from 'react';
import { matchAll, refOf, saleOf, refundOf } from '../../domain/selectors.js';
import { getCategory } from '../../domain/categories.js';
import { fmt, sfmt, neg, dec, decNeg, shortRefOf, downloadCsv } from '../../domain/format.js';
import { C, MONO, SANS, INK, INK2, ACCENT, SEV_ORDER, SEV_COLOR } from '../../styles/tokens.js';
import { useColumns } from '../../styles/columns.js';
import { TABLE_INSET, bodyRow, headerRow, totalRow, totalLabel, rowRule, figureColor, discColor, deductionColor, labelColor } from '../../styles/table.js';
import { HoverRow, SevDot, GhostButton, useDismiss, copyText, FilterStrip } from '../common.jsx';
import { SortHeader, EmptyState, TableFooter, GlyphKey } from './TableParts.jsx';
import { BREAKS_HELP as HELP } from './columnHelp.js';
import { COL, EXPORT_COLUMNS, project } from './exportColumns.js';
import SearchHelp from './SearchHelp.jsx';
import BreakDetail from '../BreakDetail.jsx';

// Labels first, then one uniformly right-aligned block of figures and dates, so
// every gutter right of `ref` is identical. See src/styles/columns.js.
const SPEC = [
  { key: 'category', min: 120 },
  { key: 'merchant', min: 64 },
  { key: 'ref', min: 88 },
  // Sales → Refunds → Fees → Exp pay → Settled → Discrepancy reads left to right as the
  // arithmetic, matching the Transactions, Summary and Merchants tables.
  { key: 'sales', min: 64, align: 'right' },
  { key: 'refunds', min: 64, align: 'right' },
  { key: 'fees', min: 48, align: 'right' },
  { key: 'expected', min: 64, align: 'right' },
  { key: 'settled', min: 64, align: 'right' },
  { key: 'impact', min: 64, align: 'right' },
  { key: 'captured', min: 64, align: 'right' },
  { key: 'date', min: 64, align: 'right' },
  // Follows the right-aligned `date`, so it supplies its own gutter via slack.
  { key: 'caret', min: 8, align: 'right' },
];

const NATURAL = { category: 'asc', merchant: 'asc', ref: 'asc', sales: 'desc', refunds: 'desc', fees: 'desc', expected: 'desc', settled: 'desc', impact: 'desc', captured: 'desc', date: 'desc' };

// Search grammar, also offered via the `?` popover. Breaks omits the type qualifier the
// Transactions tab names, so this must not be shared with it.
const SEARCH_TITLE =
  'Terms are combined with AND. Plain text matches ids, merchant, refs and category. ' +
  'A decimal matches sales, refunds, fees, settled or discrepancy. A date or range (2026-06-01..2026-06-05) ' +
  'matches either date column; prefix with captured: or settled: to pin it to one.';

export default function BreaksTab({ model, br, setBr, expanded, setExpanded, flash }) {
  const { query, catFilter, merchantFilter, sortKey, sortDir } = br;
  const catMenuRef = useDismiss(br.catOpen, () => setBr((b) => ({ ...b, catOpen: false })));
  const tableRef = useRef(null);
  const { template: COLS, gap: GAP, cell } = useColumns(tableRef, SPEC);

  const breaks = model.included.filter((r) => r.category !== 'CLEAN_MATCH');
  const chipCounts = {};
  breaks.forEach((r) => (chipCounts[r.category] = (chipCounts[r.category] || 0) + 1));

  let filtered = breaks.filter((r) => {
    if (catFilter.length && !catFilter.includes(r.category)) return false;
    if (merchantFilter && r.merchantId !== merchantFilter) return false;
    return matchAll(r, query);
  });

  const sevRank = (r) => SEV_ORDER[getCategory(r.category).sev];
  const capOf = (r) => (r.ledger ? r.ledger.capturedAt : '');
  const cmpBase = {
    impact: (a, b) => Math.abs(a.rowImpact) - Math.abs(b.rowImpact) || sevRank(b) - sevRank(a),
    category: (a, b) => getCategory(a.category).label.localeCompare(getCategory(b.category).label),
    merchant: (a, b) => String(a.merchantId).localeCompare(String(b.merchantId)) || Math.abs(b.rowImpact) - Math.abs(a.rowImpact),
    captured: (a, b) => String(capOf(a)).localeCompare(String(capOf(b))),
    date: (a, b) => String(a.date).localeCompare(String(b.date)),
    ref: (a, b) => String(refOf(a)).localeCompare(String(refOf(b))),
    sales: (a, b) => (saleOf(a) || 0) - (saleOf(b) || 0),
    refunds: (a, b) => (refundOf(a) || 0) - (refundOf(b) || 0),
    fees: (a, b) => a.rowFees - b.rowFees,
    expected: (a, b) => a.rowExpected - b.rowExpected,
    settled: (a, b) => a.rowActual - b.rowActual,
  };
  const base = cmpBase[sortKey] || cmpBase.impact;
  const flip = sortDir === 'asc' ? 1 : -1;
  const missing = (r) =>
    (sortKey === 'captured' && !capOf(r)) ||
    (sortKey === 'date' && r.date === '—') ||
    (sortKey === 'ref' && !refOf(r)) ||
    // Not the old `!r.ledger` test: sorting by Sales sinks every refund row, and vice
    // versa, since each row only ever populates one of the two. `expected` is defined
    // for every row (an unattributed settlement's is 0 − fees), so it never sinks.
    (sortKey === 'sales' && saleOf(r) === null) ||
    (sortKey === 'refunds' && refundOf(r) === null) ||
    (sortKey === 'fees' && r.settlements.length === 0) ||
    (sortKey === 'settled' && r.settlements.length === 0);
  filtered = filtered.slice().sort((a, b) => {
    const ma = missing(a);
    const mb = missing(b);
    if (ma !== mb) return ma ? 1 : -1;
    return base(a, b) * flip;
  });

  const setSort = (key) =>
    setBr((b) => (b.sortKey === key ? { ...b, sortDir: b.sortDir === 'asc' ? 'desc' : 'asc' } : { ...b, sortKey: key, sortDir: NATURAL[key] }));

  const filterBits = [];
  if (catFilter.length) filterBits.push('category: ' + catFilter.map((k) => getCategory(k).label).join(', '));
  if (merchantFilter) filterBits.push('merchant: ' + merchantFilter);
  if (query.trim()) filterBits.push('search: "' + query.trim() + '"');

  // Totals cover the rows on screen, not every break: this table is the most heavily
  // filtered in the app, so a total that ignored the filters would mislead. Each row is
  // one ReconRow, so a plain sum is correct — no per-settlement double counting here.
  const t = filtered.reduce(
    (a, r) => ({
      sales: a.sales + (saleOf(r) || 0),
      refunds: a.refunds + (refundOf(r) || 0),
      fees: a.fees + r.rowFees,
      expected: a.expected + r.rowExpected,
      settled: a.settled + r.rowActual,
      impact: a.impact + r.rowImpact,
    }),
    { sales: 0, refunds: 0, fees: 0, expected: 0, settled: 0, impact: 0 },
  );

  // Deep link to the open row, matching the design footer's right span.
  const deepLink = expanded ? `/report/breaks/${expanded}` : '/report/breaks';

  const SORT_LABEL = {
    impact: 'absolute discrepancy, then severity',
    captured: 'capture date',
    merchant: 'merchant',
    date: 'settlement date',
    ref: 'merchant ref',
    sales: 'sales amount',
    refunds: 'refund amount',
    fees: 'fees charged',
    expected: 'expected pay',
    settled: 'settled amount',
  };
  const sortLabel = (SORT_LABEL[sortKey] || 'category name') + (sortDir === 'asc' ? ' ↑ ascending' : ' ↓ descending');

  // One line per settlement, so a break that settled in parts spans several. Rows are
  // built by name and projected through the header, rather than as an array whose indices
  // had to be kept in lockstep with it by hand.
  const exportCsv = () => {
    const out = filtered.reduce((acc, r) => {
      const parts = r.settlements.length;
      // The transaction-level fields, shared by every line this break expands into.
      const shared = {
        [COL.category]: getCategory(r.category).label,
        [COL.severity]: getCategory(r.category).sev,
        [COL.merchant]: r.merchantId,
        [COL.merchantRef]: r.ledger ? r.ledger.merchantRef || '' : r.settlements[0].merchantRef || '',
        [COL.txnId]: r.ledger ? r.ledger.id : '',
        [COL.capturedOn]: r.ledger ? r.ledger.capturedAt : '',
        [COL.sales]: dec(saleOf(r)),
        [COL.refunds]: decNeg(refundOf(r)),
        [COL.expected]: dec(r.rowExpected),
        [COL.discrepancy]: dec(r.rowImpact),
      };
      if (!parts) return acc.concat([project(EXPORT_COLUMNS.breaks, shared)]);
      return acc.concat(
        r.settlements.map((x, i) =>
          project(EXPORT_COLUMNS.breaks, {
            ...shared,
            [COL.networkRef]: x.ref,
            [COL.part]: parts > 1 ? `${i + 1}/${parts}` : '',
            [COL.settledOn]: x.date,
            [COL.interchange]: decNeg(x.interchange),
            [COL.processor]: decNeg(x.processor),
            [COL.fees]: decNeg((x.interchange || 0) + (x.processor || 0)),
            [COL.settled]: dec(x.settled),
            // The ledger-side figures belong to the transaction, not to each payout, so
            // they print on part 1 and are blank on every later line.
            ...(i > 0
              ? { [COL.sales]: '', [COL.refunds]: '', [COL.expected]: '', [COL.discrepancy]: '' }
              : null),
          }),
        ),
      );
    }, []);
    const n = downloadCsv('breaks.csv', EXPORT_COLUMNS.breaks, out);
    // Lines and breaks differ whenever a break settled in parts, and the footer beside
    // this counts breaks — so say both rather than pick one to be wrong about.
    flash(`breaks.csv — ${n === filtered.length ? `${n} rows` : `${filtered.length} breaks over ${n} rows`}`);
  };

  const brkCatLabel = catFilter.length === 0 ? 'All categories' : catFilter.length === 1 ? getCategory(catFilter[0]).label : catFilter.length + ' categories';

  return (
    <section>
      {/* header + toolbar */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px 8px 0 0', borderBottom: 0, padding: '14px 18px' }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Breaks</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
          Click a row to expand the full transaction detail.
        </p>
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setBr((b) => ({ ...b, query: e.target.value }))}
            placeholder="Search id, merchant, ref, amount, or date — e.g. captured:2026-06-01..2026-06-05"
            title={SEARCH_TITLE}
            style={{ flex: 1, minWidth: 260, padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, color: INK }}
          />
          <SearchHelp
            open={br.helpOpen}
            onToggle={() => setBr((b) => ({ ...b, helpOpen: !b.helpOpen }))}
            onClose={() => setBr((b) => ({ ...b, helpOpen: false }))}
            align="right"
          />
          <div ref={catMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-expanded={br.catOpen}
              onClick={() => setBr((b) => ({ ...b, catOpen: !b.catOpen }))}
              style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${catFilter.length ? '#bcd0f5' : C.border}`, background: catFilter.length ? '#eaf0fd' : C.surface, color: catFilter.length ? ACCENT : INK2, padding: '6px 10px', fontSize: 12, borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              <span>{brkCatLabel}</span>
              <span aria-hidden="true" style={{ color: C.dim, fontSize: 10 }}>▾</span>
            </button>
            {br.catOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, width: 272, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, boxShadow: '0 12px 28px rgba(19,26,36,0.13)', padding: 6, animation: 'riseIn 120ms ease-out' }}>
                {Object.keys(chipCounts).map((k) => {
                  const on = catFilter.includes(k);
                  return (
                    <label key={k} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={on} onChange={() => setBr((b) => ({ ...b, catFilter: on ? b.catFilter.filter((x) => x !== k) : [...b.catFilter, k] }))} style={{ accentColor: '#2f5fd0' }} />
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <SevDot color={SEV_COLOR[getCategory(k).sev]} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCategory(k).label}</span>
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>{chipCounts[k]}</span>
                    </label>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: `1px solid ${C.borderSoft}`, marginTop: 4, padding: '7px 8px 3px' }}>
                  <button type="button" onClick={() => setBr((b) => ({ ...b, catFilter: [] }))} style={{ border: 0, background: 'none', padding: 0, fontSize: 11, color: ACCENT, cursor: 'pointer' }}>Clear</button>
                  <button type="button" onClick={() => setBr((b) => ({ ...b, catOpen: false }))} style={{ border: 0, background: 'none', padding: 0, fontSize: 11, color: INK2, cursor: 'pointer' }}>Done</button>
                </div>
              </div>
            )}
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <GhostButton onClick={exportCsv}>Export CSV</GhostButton>
          </div>
        </div>
      </div>

      <FilterStrip bits={filterBits} onClear={() => setBr((b) => ({ ...b, catFilter: [], merchantFilter: null, query: '' }))} />

      <div ref={tableRef} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '0 0 8px 8px' }}>
        <div role="table" aria-label="Breaks" style={{ fontSize: 13 }}>
          <div role="row" style={headerRow(COLS, GAP, true)}>
            <SortHeader label="Category" help={HELP.category} style={cell('category')} active={sortKey === 'category'} dir={sortDir} onClick={() => setSort('category')} />
            <SortHeader label="Merchant" help={HELP.merchant} style={cell('merchant')} active={sortKey === 'merchant'} dir={sortDir} onClick={() => setSort('merchant')} />
            <SortHeader label="Merchant ref" help={HELP.ref} style={cell('ref')} active={sortKey === 'ref'} dir={sortDir} onClick={() => setSort('ref')} />
            <SortHeader label="Sales" help={HELP.sales} style={cell('sales')} active={sortKey === 'sales'} dir={sortDir} onClick={() => setSort('sales')} />
            <SortHeader label="Refunds" help={HELP.refunds} style={cell('refunds')} active={sortKey === 'refunds'} dir={sortDir} onClick={() => setSort('refunds')} />
            <SortHeader label="Fees" help={HELP.fees} style={cell('fees')} active={sortKey === 'fees'} dir={sortDir} onClick={() => setSort('fees')} />
            <SortHeader label="Exp pay" help={HELP.expected} style={cell('expected')} active={sortKey === 'expected'} dir={sortDir} onClick={() => setSort('expected')} />
            <SortHeader label="Settled" help={HELP.settled} style={cell('settled')} active={sortKey === 'settled'} dir={sortDir} onClick={() => setSort('settled')} />
            <SortHeader label="Discrepancy" help={HELP.impact} style={cell('impact')} active={sortKey === 'impact'} dir={sortDir} onClick={() => setSort('impact')} />
            <SortHeader label="Captured on" help={HELP.captured} style={cell('captured')} active={sortKey === 'captured'} dir={sortDir} onClick={() => setSort('captured')} />
            <SortHeader label="Settled on" help={HELP.date} style={cell('date')} active={sortKey === 'date'} dir={sortDir} onClick={() => setSort('date')} />
            <span role="columnheader" />
          </div>

          {filtered.length === 0 && <EmptyState>No breaks match these filters.</EmptyState>}

          {filtered.map((r) => {
            const open = expanded === r.id;
            // null, not 0, when nothing settled: no fee or settlement data exists, which is
            // distinct from either being genuinely zero (refunds settle at $0.00). The
            // formatters render null as '—' and the colour helpers give it the absent ink,
            // so holding the value nullable is what keeps the two in step.
            const fees = r.settlements.length ? r.rowFees : null;
            const actual = r.settlements.length ? r.rowActual : null;
            const captured = r.ledger ? r.ledger.capturedAt : '—';
            const ledgerRef = r.ledger ? r.ledger.merchantRef || '' : '';
            const settleRef = r.settlements[0] ? r.settlements[0].merchantRef || '' : '';
            const primaryRef = r.ledger ? ledgerRef || '—' : settleRef || '—';
            const refLine2 = r.ledger && settleRef && settleRef !== ledgerRef ? settleRef : null;
            const ledgerId = r.ledger ? r.ledger.id : null;
            const netRef = r.settlements[0] ? r.settlements[0].ref : null;
            const toggle = () => setExpanded(open ? null : r.id);
            return (
              // Hover lives on the wrapper so the cells, the subline and the expanded
              // detail all tint together as one row (design lines 407/431).
              <HoverRow key={r.id} style={rowRule} hoverStyle={{ background: C.hover }}>
                <div
                  role="row"
                  aria-expanded={open}
                  onClick={toggle}
                  style={{ ...bodyRow(COLS, GAP), background: open ? C.hover : 'transparent' }}
                >
                  <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, fontFamily: SANS }}>
                    <SevDot color={SEV_COLOR[getCategory(r.category).sev]} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCategory(r.category).label}</span>
                  </span>
                  <span role="cell" style={{ color: INK2, fontSize: 12, alignSelf: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchantId}</span>
                  <span role="cell" style={{ display: 'grid', gap: 2, alignContent: 'center', minWidth: 0, overflow: 'hidden' }}>
                    <span style={{ color: labelColor(primaryRef), fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primaryRef}</span>
                    {refLine2 && <span style={{ color: C.dim, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{refLine2}</span>}
                  </span>
                  {/* Colour carries sign only: a real deduction is red, a zero is not, and a
                      dash takes the absent ink so it never outweighs a figure beside it. */}
                  <span role="cell" style={{ ...cell('sales'), whiteSpace: 'nowrap', color: figureColor(saleOf(r)) }}>{fmt(saleOf(r))}</span>
                  <span role="cell" style={{ ...cell('refunds'), whiteSpace: 'nowrap', color: deductionColor(refundOf(r)) }}>{neg(refundOf(r))}</span>
                  <span role="cell" style={{ ...cell('fees'), whiteSpace: 'nowrap', color: deductionColor(fees) }}>{neg(fees)}</span>
                  <span role="cell" style={{ ...cell('expected'), whiteSpace: 'nowrap', color: figureColor(r.rowExpected) }}>{fmt(r.rowExpected)}</span>
                  <span role="cell" style={{ ...cell('settled'), whiteSpace: 'nowrap', color: figureColor(actual) }}>{fmt(actual)}</span>
                  <span role="cell" style={{ ...cell('impact'), whiteSpace: 'nowrap', fontWeight: 500, color: discColor(r.rowImpact) }}>{sfmt(r.rowImpact)}</span>
                  <span role="cell" style={{ ...cell('captured'), color: labelColor(captured), fontSize: 12, alignSelf: 'center' }}>{captured}</span>
                  <span role="cell" style={{ ...cell('date'), color: labelColor(r.date), fontSize: 12, alignSelf: 'center' }}>{r.date}</span>
                  <span role="cell" aria-hidden="true" style={{ ...cell('caret'), color: C.dim, alignSelf: 'center' }}>{open ? '▴' : '▾'}</span>
                </div>
                {(ledgerId || netRef) && (
                  <div onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: `0 ${TABLE_INSET}px 7px`, marginTop: -4, cursor: 'pointer', fontFamily: MONO, fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      disabled={!ledgerId}
                      title="Copy internal txn id"
                      onClick={(e) => { e.stopPropagation(); copyText(ledgerId, 'Internal txn id', flash); }}
                      style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: ledgerId ? 'copy' : 'default' }}
                    >
                      {ledgerId || 'no ledger id'}
                    </button>
                    <span aria-hidden="true" style={{ color: '#cfd6e0' }}>·</span>
                    <button
                      type="button"
                      disabled={!netRef}
                      title="Copy network ref"
                      onClick={(e) => { e.stopPropagation(); copyText(netRef, 'Network ref', flash); }}
                      style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: netRef ? 'copy' : 'default' }}
                    >
                      {netRef ? shortRefOf(netRef) : 'no settlement'}
                    </button>
                  </div>
                )}
                {open && <BreakDetail row={r} model={model} />}
              </HoverRow>
            );
          })}

          {/* Money cells go through `cell(key)` like the body rows, so the total lines up
              with the columns rather than merely being right-aligned. Dates get no total. */}
          {filtered.length > 0 && (
            <div role="row" style={totalRow(COLS, GAP)}>
              <span role="cell" style={totalLabel}>
                {filtered.length < breaks.length ? `Total — ${filtered.length} of ${breaks.length} breaks` : 'Total'}
              </span>
              <span /><span />
              <span role="cell" style={{ ...cell('sales'), whiteSpace: 'nowrap', color: figureColor(t.sales) }}>{fmt(t.sales)}</span>
              <span role="cell" style={{ ...cell('refunds'), whiteSpace: 'nowrap', color: deductionColor(t.refunds) }}>{neg(t.refunds)}</span>
              <span role="cell" style={{ ...cell('fees'), whiteSpace: 'nowrap', color: deductionColor(t.fees) }}>{neg(t.fees)}</span>
              <span role="cell" style={{ ...cell('expected'), whiteSpace: 'nowrap', color: figureColor(t.expected) }}>{fmt(t.expected)}</span>
              <span role="cell" style={{ ...cell('settled'), whiteSpace: 'nowrap', color: figureColor(t.settled) }}>{fmt(t.settled)}</span>
              <span role="cell" style={{ ...cell('impact'), whiteSpace: 'nowrap', color: discColor(t.impact) }}>{sfmt(t.impact)}</span>
              <span /><span /><span />
            </div>
          )}
        </div>
        <TableFooter
          style={{ borderRadius: '0 0 8px 8px' }}
          left={`${filtered.length} of ${breaks.length} breaks · sorted by ${sortLabel}`}
          right={<span style={{ fontFamily: MONO }}>{deepLink}</span>}
          legend={<GlyphKey keys={['dash', 'zero']} />}
        />
      </div>
    </section>
  );
}
