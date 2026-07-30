import React, { useRef } from 'react';
import { matchAll, refOf } from '../../domain/selectors.js';
import { getCategory } from '../../domain/categories.js';
import { fmt, sfmt, dec, shortRefOf, downloadCsv } from '../../domain/format.js';
import { C, MONO, SANS, INK, INK2, NEG, POS, ACCENT, SEV_ORDER, SEV_COLOR } from '../../styles/tokens.js';
import { useColumns } from '../../styles/columns.js';
import { HoverRow, SevDot, GhostButton, useDismiss, copyText } from '../common.jsx';
import SearchHelp from './SearchHelp.jsx';
import BreakDetail from '../BreakDetail.jsx';

// Labels first, then one uniformly right-aligned block of figures and dates, so
// every gutter right of `ref` is identical. See src/styles/columns.js.
const SPEC = [
  { key: 'category', min: 120 },
  { key: 'merchant', min: 64 },
  { key: 'ref', min: 88 },
  { key: 'gross', min: 64, align: 'right' },
  { key: 'fees', min: 48, align: 'right' },
  { key: 'settled', min: 64, align: 'right' },
  { key: 'impact', min: 64, align: 'right' },
  { key: 'captured', min: 64, align: 'right' },
  { key: 'date', min: 64, align: 'right' },
  // Follows the right-aligned `date`, so it supplies its own gutter via slack.
  { key: 'caret', min: 8, align: 'right' },
];

const NATURAL = { category: 'asc', merchant: 'asc', ref: 'asc', gross: 'desc', fees: 'desc', settled: 'desc', impact: 'desc', captured: 'desc', date: 'desc' };

// Search grammar, also offered via the `?` popover. Breaks omits type and fees —
// it has no such columns — so this must not be shared with the Transactions tab.
const SEARCH_TITLE =
  'Terms are combined with AND. Plain text matches ids, merchant, refs and category. ' +
  'A decimal matches gross, fees, settled or discrepancy. A date or range (2026-06-01..2026-06-05) ' +
  'matches either date column; prefix with captured: or settled: to pin it to one.';

function SortHeader({ label, active, dir, onClick, right }) {
  return (
    <button
      type="button"
      role="columnheader"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={onClick}
      style={{
        border: 0,
        background: 'none',
        padding: 0,
        font: 'inherit',
        color: 'inherit',
        textTransform: 'inherit',
        letterSpacing: 'inherit',
        cursor: 'pointer',
        textAlign: right ? 'right' : 'left',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {label}
      {active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

export default function BreaksTab({ model, br, setBr, expanded, setExpanded, flash }) {
  const { query, catFilter, merchantFilter, sortKey, sortDir } = br;
  const catMenuRef = useDismiss(br.catOpen, () => setBr((b) => ({ ...b, catOpen: false })));
  const tableRef = useRef(null);
  const { template: COLS, gap: GAP, cell, isRight } = useColumns(tableRef, SPEC);

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
    gross: (a, b) => (a.ledger ? a.ledger.gross || 0 : 0) - (b.ledger ? b.ledger.gross || 0 : 0),
    fees: (a, b) => a.rowFees - b.rowFees,
    settled: (a, b) => a.rowActual - b.rowActual,
  };
  const base = cmpBase[sortKey] || cmpBase.impact;
  const flip = sortDir === 'asc' ? 1 : -1;
  const missing = (r) =>
    (sortKey === 'captured' && !capOf(r)) ||
    (sortKey === 'date' && r.date === '—') ||
    (sortKey === 'ref' && !refOf(r)) ||
    (sortKey === 'gross' && !r.ledger) ||
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

  // Deep link to the open row, matching the design footer's right span.
  const deepLink = expanded ? `/report/breaks/${expanded}` : '/report/breaks';

  const SORT_LABEL = {
    impact: 'absolute discrepancy, then severity',
    captured: 'capture date',
    merchant: 'merchant',
    date: 'settlement date',
    ref: 'merchant ref',
    gross: 'ledger gross',
    fees: 'fees charged',
    settled: 'settled amount',
  };
  const sortLabel = (SORT_LABEL[sortKey] || 'category name') + (sortDir === 'asc' ? ' ↑ ascending' : ' ↓ descending');

  const exportCsv = () => {
    const out = filtered.reduce((acc, r) => {
      const b = [
        getCategory(r.category).label,
        getCategory(r.category).sev,
        r.merchantId,
        r.ledger ? r.ledger.merchantRef || '' : r.settlements[0].merchantRef || '',
        r.ledger ? r.ledger.id : '',
        '',
        r.ledger ? r.ledger.capturedAt : '',
        '',
        dec(r.ledger ? r.ledger.gross : null),
        '',
        '',
        '',
        dec(r.rowImpact),
      ];
      if (!r.settlements.length) return acc.concat([b]);
      return acc.concat(
        r.settlements.map((x, i) => {
          const row = b.slice();
          row[5] = x.ref;
          row[7] = x.date;
          row[9] = dec(x.settled);
          row[10] = dec(x.interchange);
          row[11] = dec(x.processor);
          if (i > 0) {
            row[8] = '';
            row[12] = '';
          }
          return row;
        }),
      );
    }, []);
    const n = downloadCsv(
      'breaks.csv',
      ['Category', 'Severity', 'Merchant', 'Merchant ref', 'Internal txn id', 'Network ref', 'Captured on', 'Settled on', 'Gross', 'Settled', 'Interchange', 'Processor', 'Discrepancy'],
      out,
    );
    flash(`breaks.csv — ${n} rows exported`);
  };

  const brkCatLabel = catFilter.length === 0 ? 'All categories' : catFilter.length === 1 ? getCategory(catFilter[0]).label : catFilter.length + ' categories';

  return (
    <section>
      {/* toolbar */}
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px 8px 0 0', borderBottom: 0, padding: '12px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
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
            style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${catFilter.length ? '#bcd0f5' : C.border}`, background: catFilter.length ? '#eaf0fd' : '#fff', color: catFilter.length ? ACCENT : INK2, padding: '6px 10px', fontSize: 12, borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <span>{brkCatLabel}</span>
            <span aria-hidden="true" style={{ color: '#9aa3b0', fontSize: 10 }}>▾</span>
          </button>
          {br.catOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, width: 272, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 7, boxShadow: '0 12px 28px rgba(19,26,36,0.13)', padding: 6, animation: 'riseIn 120ms ease-out' }}>
              {Object.keys(chipCounts).map((k) => {
                const on = catFilter.includes(k);
                return (
                  <label key={k} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => setBr((b) => ({ ...b, catFilter: on ? b.catFilter.filter((x) => x !== k) : [...b.catFilter, k] }))} style={{ accentColor: '#2f5fd0' }} />
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <SevDot color={SEV_COLOR[getCategory(k).sev]} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCategory(k).label}</span>
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: '#9aa3b0' }}>{chipCounts[k]}</span>
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

      {filterBits.length > 0 && (
        <div style={{ background: C.surfaceAlt, borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: INK2 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: '#7b8697' }}>{filterBits.join('  ·  ')}</span>
          <button type="button" onClick={() => setBr((b) => ({ ...b, catFilter: [], merchantFilter: null, query: '' }))} style={{ border: 0, background: 'none', color: ACCENT, fontSize: 12, cursor: 'pointer', padding: 0 }}>Clear filters</button>
        </div>
      )}

      <div ref={tableRef} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '0 0 8px 8px' }}>
        <div role="table" aria-label="Breaks" style={{ fontSize: 13 }}>
          <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: GAP, padding: '9px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7b8697', position: 'sticky', top: 56, zIndex: 5 }}>
            <SortHeader label="Category" active={sortKey === 'category'} dir={sortDir} onClick={() => setSort('category')} />
            <SortHeader label="Merchant" active={sortKey === 'merchant'} dir={sortDir} onClick={() => setSort('merchant')} />
            <SortHeader label="Merchant ref" active={sortKey === 'ref'} dir={sortDir} onClick={() => setSort('ref')} />
            <SortHeader label="Gross" right={isRight('gross')} active={sortKey === 'gross'} dir={sortDir} onClick={() => setSort('gross')} />
            <SortHeader label="Fees" right={isRight('fees')} active={sortKey === 'fees'} dir={sortDir} onClick={() => setSort('fees')} />
            <SortHeader label="Settled" right={isRight('settled')} active={sortKey === 'settled'} dir={sortDir} onClick={() => setSort('settled')} />
            <SortHeader label="Discrepancy" right={isRight('impact')} active={sortKey === 'impact'} dir={sortDir} onClick={() => setSort('impact')} />
            <SortHeader label="Captured on" right={isRight('captured')} active={sortKey === 'captured'} dir={sortDir} onClick={() => setSort('captured')} />
            <SortHeader label="Settled on" right={isRight('date')} active={sortKey === 'date'} dir={sortDir} onClick={() => setSort('date')} />
            <span role="columnheader" />
          </div>

          {filtered.length === 0 && <div style={{ padding: '40px 18px', textAlign: 'center', color: '#7b8697', fontSize: 13 }}>No breaks match these filters.</div>}

          {filtered.map((r) => {
            const open = expanded === r.id;
            const impactColor = r.rowImpact === 0 ? INK2 : r.rowImpact < 0 ? NEG : POS;
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
              <HoverRow key={r.id} style={{ borderBottom: `1px solid ${C.rowRule}` }} hoverStyle={{ background: C.hover }}>
                <div
                  role="row"
                  aria-expanded={open}
                  onClick={toggle}
                  style={{ display: 'grid', gridTemplateColumns: COLS, gap: GAP, padding: '10px 16px', cursor: 'pointer', background: open ? C.hover : 'transparent', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}
                >
                  <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, fontFamily: SANS }}>
                    <SevDot color={SEV_COLOR[getCategory(r.category).sev]} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCategory(r.category).label}</span>
                  </span>
                  <span role="cell" style={{ color: INK2, fontSize: 12, alignSelf: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchantId}</span>
                  <span role="cell" style={{ display: 'grid', gap: 2, alignContent: 'center', minWidth: 0, overflow: 'hidden' }}>
                    <span style={{ color: INK2, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primaryRef}</span>
                    {refLine2 && <span style={{ color: '#9aa3b0', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{refLine2}</span>}
                  </span>
                  <span role="cell" style={{ ...cell('gross'), whiteSpace: 'nowrap' }}>{r.ledger ? fmt(r.ledger.gross) : '—'}</span>
                  {/* '—' not '$0.00' when nothing settled: no fee data exists, which is
                      distinct from fees genuinely being zero (refunds settle at $0.00). */}
                  <span role="cell" style={{ ...cell('fees'), whiteSpace: 'nowrap', color: INK2 }}>{r.settlements.length ? fmt(r.rowFees) : '—'}</span>
                  <span role="cell" style={{ ...cell('settled'), whiteSpace: 'nowrap' }}>{r.settlements.length ? fmt(r.rowActual) : '—'}</span>
                  <span role="cell" style={{ ...cell('impact'), whiteSpace: 'nowrap', fontWeight: 500, color: impactColor }}>{sfmt(r.rowImpact)}</span>
                  <span role="cell" style={{ ...cell('captured'), color: r.ledger ? INK2 : '#9aa3b0', fontSize: 12, alignSelf: 'center' }}>{r.ledger ? r.ledger.capturedAt : '—'}</span>
                  <span role="cell" style={{ ...cell('date'), color: INK2, fontSize: 12, alignSelf: 'center' }}>{r.date}</span>
                  <span role="cell" aria-hidden="true" style={{ ...cell('caret'), color: '#9aa3b0', alignSelf: 'center' }}>{open ? '▴' : '▾'}</span>
                </div>
                {(ledgerId || netRef) && (
                  <div onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px 7px', marginTop: -4, cursor: 'pointer', fontFamily: MONO, fontSize: 11, color: '#7b8697', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      disabled={!ledgerId}
                      title="Copy internal txn id"
                      onClick={(e) => { e.stopPropagation(); copyText(ledgerId, 'Internal txn id', flash); }}
                      style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: ledgerId ? 'inherit' : '#c2c8d2', cursor: ledgerId ? 'copy' : 'default' }}
                    >
                      {ledgerId || 'no ledger id'}
                    </button>
                    <span aria-hidden="true" style={{ color: '#cfd6e0' }}>·</span>
                    <button
                      type="button"
                      disabled={!netRef}
                      title="Copy network ref"
                      onClick={(e) => { e.stopPropagation(); copyText(netRef, 'Network ref', flash); }}
                      style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: netRef ? 'inherit' : '#c2c8d2', cursor: netRef ? 'copy' : 'default' }}
                    >
                      {netRef ? shortRefOf(netRef) : 'no settlement'}
                    </button>
                  </div>
                )}
                {open && <BreakDetail row={r} model={model} />}
              </HoverRow>
            );
          })}
        </div>
        <div style={{ padding: '11px 16px', borderTop: `1px solid ${C.borderSoft}`, background: C.surfaceAlt, borderRadius: '0 0 8px 8px', fontSize: 11, color: '#9aa3b0', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{filtered.length} of {breaks.length} breaks · sorted by {sortLabel}</span>
          <span style={{ fontFamily: MONO }}>{deepLink}</span>
        </div>
      </div>
    </section>
  );
}
