import React from 'react';
import { matchAll, refOf } from '../../domain/selectors.js';
import { getCategory } from '../../domain/categories.js';
import { fmt, sfmt, dec, downloadCsv } from '../../domain/format.js';
import { C, MONO, SANS, INK, INK2, NEG, POS, ACCENT, SEV_ORDER, SEV_COLOR } from '../../styles/tokens.js';
import { HoverRow, SevDot, GhostButton, useDismiss } from '../common.jsx';
import BreakDetail from '../BreakDetail.jsx';

const COLS =
  'minmax(84px, 1.1fr) minmax(78px, 0.7fr) minmax(104px, 1fr) minmax(58px, 0.7fr) minmax(58px, 0.7fr) minmax(90px, 0.9fr) minmax(94px, 0.85fr) minmax(84px, 0.8fr) 16px';

const NATURAL = { category: 'asc', merchant: 'asc', ref: 'asc', gross: 'desc', settled: 'desc', impact: 'desc', captured: 'desc', date: 'desc' };

const SEARCH_HELP = [
  ['ORD-008  MERCH-006', 'plain text — ids, network refs, merchant, merchant ref, type, category'],
  ['831.42   $1,557.02', 'any money column — gross, settled, fees or discrepancy'],
  ['2026-06-05', 'either date column'],
  ['2026-06', 'the whole month'],
  ['2026-06-01..2026-06-05', 'a date range, inclusive'],
  ['captured:  settled:', 'pin a date to one column; settled: also accepts an amount'],
  ['gross: fees: disc:', 'pin an amount to one column; amount: searches all four'],
  ['type:refund  category:', 'match sale or refund, or a category name'],
];

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
  const helpRef = useDismiss(br.helpOpen, () => setBr((b) => ({ ...b, helpOpen: false })));

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
    settled: (a, b) => a.rowActual - b.rowActual,
  };
  const base = cmpBase[sortKey] || cmpBase.impact;
  const flip = sortDir === 'asc' ? 1 : -1;
  const missing = (r) =>
    (sortKey === 'captured' && !capOf(r)) ||
    (sortKey === 'date' && r.date === '—') ||
    (sortKey === 'ref' && !refOf(r)) ||
    (sortKey === 'gross' && !r.ledger) ||
    (sortKey === 'settled' && r.settlements.length === 0);
  filtered = filtered.slice().sort((a, b) => {
    const ma = missing(a);
    const mb = missing(b);
    if (ma !== mb) return ma ? 1 : -1;
    return base(a, b) * flip;
  });

  const maxImpact = Math.max(1, ...breaks.map((r) => Math.abs(r.rowImpact)));
  const setSort = (key) =>
    setBr((b) => (b.sortKey === key ? { ...b, sortDir: b.sortDir === 'asc' ? 'desc' : 'asc' } : { ...b, sortKey: key, sortDir: NATURAL[key] }));

  const filterBits = [];
  if (catFilter.length) filterBits.push('category: ' + catFilter.map((k) => getCategory(k).label).join(', '));
  if (merchantFilter) filterBits.push('merchant: ' + merchantFilter);
  if (query.trim()) filterBits.push('search: "' + query.trim() + '"');

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
          style={{ flex: 1, minWidth: 260, padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, color: INK }}
        />
        <div ref={helpRef} style={{ position: 'relative' }}>
          <button
            type="button"
            title="Search help"
            aria-expanded={br.helpOpen}
            onClick={() => setBr((b) => ({ ...b, helpOpen: !b.helpOpen }))}
            style={{ width: 26, height: 26, border: `1px solid ${br.helpOpen ? '#bcd0f5' : C.border}`, background: br.helpOpen ? '#eaf0fd' : '#fff', color: br.helpOpen ? ACCENT : INK2, borderRadius: 5, fontSize: 12, cursor: 'pointer', lineHeight: 1 }}
          >
            ?
          </button>
          {br.helpOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, width: 372, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 7, boxShadow: '0 12px 28px rgba(19,26,36,0.13)', padding: '12px 14px', animation: 'riseIn 120ms ease-out' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: INK, marginBottom: 8 }}>Search</div>
              <p style={{ margin: '0 0 9px', fontSize: 12, color: INK2 }}>Terms are combined with AND. Plain words match ids, merchant, refs, type and category.</p>
              {SEARCH_HELP.map(([syntax, note], i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '148px 1fr', gap: 10, padding: '3px 0', borderTop: `1px solid ${C.rowRule}` }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: INK }}>{syntax}</span>
                  <span style={{ fontSize: 11, color: '#7b8697' }}>{note}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '0 0 8px 8px' }}>
        <div role="table" aria-label="Breaks" style={{ fontSize: 13 }}>
          <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '9px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7b8697' }}>
            <SortHeader label="Category" active={sortKey === 'category'} dir={sortDir} onClick={() => setSort('category')} />
            <SortHeader label="Merchant" active={sortKey === 'merchant'} dir={sortDir} onClick={() => setSort('merchant')} />
            <SortHeader label="Merchant ref" active={sortKey === 'ref'} dir={sortDir} onClick={() => setSort('ref')} />
            <SortHeader label="Gross" right active={sortKey === 'gross'} dir={sortDir} onClick={() => setSort('gross')} />
            <SortHeader label="Settled" right active={sortKey === 'settled'} dir={sortDir} onClick={() => setSort('settled')} />
            <SortHeader label="Discrepancy" right active={sortKey === 'impact'} dir={sortDir} onClick={() => setSort('impact')} />
            <SortHeader label="Captured on" active={sortKey === 'captured'} dir={sortDir} onClick={() => setSort('captured')} />
            <SortHeader label="Settled on" active={sortKey === 'date'} dir={sortDir} onClick={() => setSort('date')} />
            <span role="columnheader" />
          </div>

          {filtered.length === 0 && <div style={{ padding: '26px 16px', color: '#9aa3b0', fontSize: 13 }}>No breaks match the current filters.</div>}

          {filtered.map((r) => {
            const open = expanded === r.id;
            const w = (Math.abs(r.rowImpact) / maxImpact) * 48;
            const impactColor = r.rowImpact === 0 ? INK2 : r.rowImpact < 0 ? NEG : POS;
            return (
              <div key={r.id} style={{ borderBottom: `1px solid ${C.rowRule}` }}>
                <HoverRow
                  role="row"
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : r.id)}
                  style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '10px 16px', cursor: 'pointer', background: open ? C.hover : 'transparent', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}
                  hoverStyle={{ background: C.hover }}
                >
                  <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, fontFamily: SANS }}>
                    <SevDot color={SEV_COLOR[getCategory(r.category).sev]} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCategory(r.category).label}</span>
                  </span>
                  <span role="cell" style={{ color: INK2, fontSize: 12, alignSelf: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchantId}</span>
                  <span role="cell" style={{ color: INK2, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', alignSelf: 'center' }}>
                    {r.ledger ? r.ledger.merchantRef || '—' : r.settlements[0].merchantRef || '—'}
                  </span>
                  <span role="cell" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.ledger ? fmt(r.ledger.gross) : '—'}</span>
                  <span role="cell" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.settlements.length ? fmt(r.rowActual) : '—'}</span>
                  <span role="cell" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 500, color: impactColor }}>{sfmt(r.rowImpact)}</span>
                  <span role="cell" style={{ color: r.ledger ? INK2 : '#9aa3b0', fontSize: 12, alignSelf: 'center' }}>{r.ledger ? r.ledger.capturedAt : '—'}</span>
                  <span role="cell" style={{ color: INK2, fontSize: 12, alignSelf: 'center' }}>{r.date}</span>
                  <span role="cell" aria-hidden="true" style={{ color: '#9aa3b0', alignSelf: 'center' }}>{open ? '▴' : '▾'}</span>
                </HoverRow>
                {open && <BreakDetail row={r} model={model} />}
              </div>
            );
          })}
        </div>
        <p style={{ margin: 0, padding: '10px 16px', borderTop: `1px solid ${C.borderSoft}`, fontSize: 11, color: '#9aa3b0' }}>
          {filtered.length} of {breaks.length} breaks
        </p>
      </div>
    </section>
  );
}
