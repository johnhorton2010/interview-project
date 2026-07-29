import React from 'react';
import { matchAll, refOf, figures } from '../../domain/selectors.js';
import { getCategory } from '../../domain/categories.js';
import { fmt, sfmt, dec, shortRefOf, downloadCsv } from '../../domain/format.js';
import { C, MONO, SANS, INK, INK2, NEG, POS, ACCENT, SEV_ORDER, SEV_COLOR } from '../../styles/tokens.js';
import { HoverRow, SevDot, GhostButton, useDismiss, segStyle } from '../common.jsx';
import BreakDetail from '../BreakDetail.jsx';

const LCOLS = 'minmax(80px,0.9fr) minmax(90px,0.8fr) minmax(58px,0.6fr) minmax(76px,0.9fr) minmax(46px,0.45fr) minmax(68px,0.75fr) minmax(74px,0.8fr) minmax(54px,0.6fr) minmax(94px,0.9fr) minmax(58px,1fr) 16px';
const SCOLS = 'minmax(88px,0.95fr) minmax(86px,0.8fr) minmax(58px,0.6fr) minmax(82px,0.9fr) minmax(44px,0.45fr) minmax(70px,0.75fr) minmax(70px,0.75fr) minmax(54px,0.6fr) minmax(88px,0.9fr) minmax(58px,1fr) 16px';
const NATURAL = { id: 'asc', captured: 'desc', merchant: 'asc', ref: 'asc', type: 'asc', gross: 'desc', settled: 'desc', fees: 'desc', disc: 'desc', category: 'asc' };

const str = (a, b) => String(a || '').localeCompare(String(b || ''));
const num = (a, b) => (a === null ? 0 : a) - (b === null ? 0 : b);

function Seg({ on, onClick, children }) {
  const st = segStyle(on);
  return (
    <button type="button" onClick={onClick} style={{ border: `1px solid ${on ? '#bcd0f5' : C.border}`, background: st.background, color: st.color, padding: '5px 10px', fontSize: 12, borderRadius: 5, cursor: 'pointer' }}>
      {children}
    </button>
  );
}

function SortH({ label, k, tx, setTx, right }) {
  const active = tx.sortKey === k;
  const onClick = () => setTx((t) => (t.sortKey === k ? { ...t, sortKey: k, sortDir: t.sortDir === 'asc' ? 'desc' : 'asc' } : { ...t, sortKey: k, sortDir: NATURAL[k] }));
  return (
    <button type="button" role="columnheader" aria-sort={active ? (tx.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={onClick} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', cursor: 'pointer', textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap', overflow: 'hidden' }}>
      {label}
      {active ? (tx.sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

export default function TransactionsTab({ model, tx, setTx, expanded, setExpanded, flash }) {
  const catMenuRef = useDismiss(tx.catOpen, () => setTx((t) => ({ ...t, catOpen: false })));
  const f = figures(model);
  const settleCentric = tx.view === 'settlement';

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
    type: (a, b) => str(a.ledger ? a.ledger.type : '', b.ledger ? b.ledger.type : ''),
    gross: (a, b) => num(a.ledger ? a.ledger.gross : 0, b.ledger ? b.ledger.gross : 0),
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
    type: (a, b) => str(a.r.ledger ? a.r.ledger.type : '', b.r.ledger ? b.r.ledger.type : ''),
    gross: (a, b) => num(a.r.ledger ? a.r.ledger.gross : 0, b.r.ledger ? b.r.ledger.gross : 0),
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
  const txGross = txVisible.reduce((n, r) => n + (r.ledger ? r.ledger.gross || 0 : 0), 0);
  const txFees = txVisible.reduce((n, r) => n + r.rowFees, 0);
  const txSettled = txVisible.reduce((n, r) => n + r.rowActual, 0);
  const txImpact = txVisible.reduce((n, r) => n + r.rowImpact, 0);
  const txAll = txVisible.length === model.included.length;
  const tieOk = !txAll || txImpact === f.discrepancy;

  const exportCsv = () => {
    let n;
    if (settleCentric) {
      const rows = settleRows
        .map((o) => {
          const parts = o.r.settlements.length;
          const idx = o.r.settlements.indexOf(o.x);
          const carrier = carrierOf[o.r.id] === idx + 1;
          return [o.x.ref, parts > 1 ? `${idx + 1}/${parts}` : '', o.x.date, o.x.merchantId, o.x.merchantRef || '', o.r.ledger ? (o.r.ledger.type === 'SALE' ? 'Sale' : 'Refund') : '', carrier && o.r.ledger ? dec(o.r.ledger.gross) : '', dec(o.x.settled), dec(feesOf(o.x)), carrier ? dec(o.r.rowImpact) : '', getCategory(o.r.category).label, o.r.ledger ? o.r.ledger.id : ''];
        })
        .concat(neverSettled.map((r) => ['', '', '', r.merchantId, r.ledger.merchantRef || '', r.ledger.type === 'SALE' ? 'Sale' : 'Refund', dec(r.ledger.gross), '', '', dec(r.rowImpact), getCategory(r.category).label, r.ledger.id]));
      n = downloadCsv('transactions-by-settlement.csv', ['Network ref', 'Part', 'Settled on', 'Merchant', 'Merchant ref', 'Type', 'Gross', 'Settled', 'Fees', 'Discrepancy', 'Category', 'Ledger txn'], rows);
    } else {
      n = downloadCsv(
        'transactions.csv',
        ['Txn id', 'Captured on', 'Merchant', 'Merchant ref', 'Type', 'Gross', 'Settled', 'Fees', 'Discrepancy', 'Category', 'Network refs'],
        txVisible.map((r) => [r.ledger ? r.ledger.id : '', r.ledger ? r.ledger.capturedAt : '', r.merchantId, r.ledger ? r.ledger.merchantRef || '' : r.settlements[0].merchantRef || '', r.ledger ? (r.ledger.type === 'SALE' ? 'Sale' : 'Refund') : '', dec(r.ledger ? r.ledger.gross : null), r.settlements.length ? dec(r.rowActual) : '', dec(r.rowFees), dec(r.rowImpact), getCategory(r.category).label, r.settlements.map((x) => x.ref).join(' ')]),
      );
    }
    flash(`${settleCentric ? 'transactions-by-settlement.csv' : 'transactions.csv'} — ${n} rows exported`);
  };

  const catLabel = tx.cats.length === 0 ? 'All categories' : tx.cats.length === 1 ? getCategory(tx.cats[0]).label : `${tx.cats.length} categories`;
  const impCol = (c) => (c === 0 ? INK2 : c < 0 ? NEG : POS);

  const renderRow = (key, cols, cells, row) => {
    const open = expanded === key;
    return (
      <div key={key} style={{ borderBottom: `1px solid ${C.rowRule}` }}>
        <HoverRow role="row" aria-expanded={open} onClick={() => setExpanded(open ? null : key)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '9px 16px', cursor: 'pointer', background: open ? C.hover : 'transparent', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', alignItems: 'center' }} hoverStyle={{ background: C.hover }}>
          {cells}
        </HoverRow>
        {open && row && <BreakDetail row={row} model={model} />}
      </div>
    );
  };

  const cell = (content, opts = {}) => (
    <span role="cell" style={{ textAlign: opts.right ? 'right' : 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: opts.color || INK, fontFamily: opts.sans ? SANS : MONO, fontWeight: opts.weight, fontSize: opts.size }} title={opts.title}>
      {content}
    </span>
  );

  return (
    <section>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px 8px 0 0', borderBottom: 0, padding: '12px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <Seg on={!settleCentric} onClick={() => setTx((t) => ({ ...t, view: 'ledger' }))}>Ledger view</Seg>
          <Seg on={settleCentric} onClick={() => setTx((t) => ({ ...t, view: 'settlement' }))}>Settlement view</Seg>
        </div>
        {!settleCentric && (
          <div style={{ display: 'flex', gap: 4 }}>
            <Seg on={tx.type === 'all'} onClick={() => setTx((t) => ({ ...t, type: 'all' }))}>All</Seg>
            <Seg on={tx.type === 'SALE'} onClick={() => setTx((t) => ({ ...t, type: 'SALE' }))}>Sales</Seg>
            <Seg on={tx.type === 'REFUND'} onClick={() => setTx((t) => ({ ...t, type: 'REFUND' }))}>Refunds</Seg>
          </div>
        )}
        <input type="search" value={tx.query} onChange={(e) => setTx((t) => ({ ...t, query: e.target.value }))} placeholder="Search…" style={{ flex: 1, minWidth: 200, padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, color: INK }} />
        <div ref={catMenuRef} style={{ position: 'relative' }}>
          <button type="button" aria-expanded={tx.catOpen} onClick={() => setTx((t) => ({ ...t, catOpen: !t.catOpen }))} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${tx.cats.length ? '#bcd0f5' : C.border}`, background: tx.cats.length ? '#eaf0fd' : '#fff', color: tx.cats.length ? ACCENT : INK2, padding: '6px 10px', fontSize: 12, borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <span>{catLabel}</span>
            <span aria-hidden="true" style={{ color: '#9aa3b0', fontSize: 10 }}>▾</span>
          </button>
          {tx.catOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, width: 272, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 7, boxShadow: '0 12px 28px rgba(19,26,36,0.13)', padding: 6 }}>
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
        <div style={{ marginLeft: 'auto' }}>
          <GhostButton onClick={exportCsv}>Export CSV</GhostButton>
        </div>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '0 0 8px 8px', overflowX: 'auto' }}>
        <div role="table" aria-label="Transactions" style={{ fontSize: 13, minWidth: 900 }}>
          {settleCentric ? (
            <>
              <div role="row" style={{ display: 'grid', gridTemplateColumns: SCOLS, gap: 8, padding: '9px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7b8697' }}>
                <SortH label="Network ref" k="id" tx={tx} setTx={setTx} />
                <SortH label="Settled on" k="captured" tx={tx} setTx={setTx} />
                <SortH label="Merchant" k="merchant" tx={tx} setTx={setTx} />
                <SortH label="Merchant ref" k="ref" tx={tx} setTx={setTx} />
                <SortH label="Type" k="type" tx={tx} setTx={setTx} />
                <SortH label="Gross" k="gross" tx={tx} setTx={setTx} right />
                <SortH label="Settled" k="settled" tx={tx} setTx={setTx} right />
                <SortH label="Fees" k="fees" tx={tx} setTx={setTx} right />
                <SortH label="Discrepancy" k="disc" tx={tx} setTx={setTx} right />
                <SortH label="Category" k="category" tx={tx} setTx={setTx} />
                <span role="columnheader" />
              </div>
              {settleRows.length === 0 && neverSettled.length === 0 && <div style={{ padding: '26px 16px', color: '#9aa3b0' }}>No settlements match.</div>}
              {settleRows.map((o) => {
                const idx = o.r.settlements.indexOf(o.x);
                const carrier = carrierOf[o.r.id] === idx + 1;
                const parts = o.r.settlements.length;
                return renderRow(
                  o.x.ref,
                  SCOLS,
                  [
                    cell(shortRefOf(o.x.ref), { key: 'a' }),
                    cell(o.x.date, { color: INK2, size: 12 }),
                    cell(o.x.merchantId, { color: INK2, size: 12 }),
                    cell(o.x.merchantRef || '—', { color: INK2, size: 12 }),
                    cell(o.r.ledger ? (o.r.ledger.type === 'SALE' ? 'Sale' : 'Refund') : '—', { sans: true, size: 12, color: o.r.ledger && o.r.ledger.type === 'REFUND' ? NEG : INK2 }),
                    cell(carrier ? (o.r.ledger ? fmt(o.r.ledger.gross) : '—') : '〃', { right: true, color: carrier && o.r.ledger ? INK : '#9aa3b0', title: carrier ? '' : `Same ledger transaction — gross shown on part ${carrierOf[o.r.id]} of ${parts}` }),
                    cell(fmt(o.x.settled), { right: true }),
                    cell(feesOf(o.x) === 0 ? '—' : fmt(feesOf(o.x)), { right: true, color: INK2 }),
                    cell(carrier ? sfmt(o.r.rowImpact) : '〃', { right: true, weight: carrier ? 500 : 400, color: carrier ? impCol(o.r.rowImpact) : '#9aa3b0' }),
                    cell(getCategory(o.r.category).label, { sans: true, size: 12, color: SEV_COLOR[getCategory(o.r.category).sev] }),
                    cell(expanded === o.x.ref ? '▴' : '▾', { color: '#9aa3b0' }),
                  ],
                  o.r,
                );
              })}
              {neverSettled.map((r) =>
                renderRow(
                  r.id,
                  SCOLS,
                  [
                    cell('—', { color: '#9aa3b0' }),
                    cell('unsettled', { color: '#9aa3b0', sans: true, size: 12 }),
                    cell(r.merchantId, { color: INK2, size: 12 }),
                    cell(r.ledger.merchantRef || '—', { color: INK2, size: 12 }),
                    cell(r.ledger.type === 'SALE' ? 'Sale' : 'Refund', { sans: true, size: 12, color: r.ledger.type === 'REFUND' ? NEG : INK2 }),
                    cell(fmt(r.ledger.gross), { right: true }),
                    cell('—', { right: true, color: '#9aa3b0' }),
                    cell('—', { right: true, color: '#9aa3b0' }),
                    cell(sfmt(r.rowImpact), { right: true, weight: 500, color: impCol(r.rowImpact) }),
                    cell(getCategory(r.category).label, { sans: true, size: 12, color: SEV_COLOR[getCategory(r.category).sev] }),
                    cell(expanded === r.id ? '▴' : '▾', { color: '#9aa3b0' }),
                  ],
                  r,
                ),
              )}
            </>
          ) : (
            <>
              <div role="row" style={{ display: 'grid', gridTemplateColumns: LCOLS, gap: 8, padding: '9px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7b8697' }}>
                <SortH label="Txn id" k="id" tx={tx} setTx={setTx} />
                <SortH label="Captured on" k="captured" tx={tx} setTx={setTx} />
                <SortH label="Merchant" k="merchant" tx={tx} setTx={setTx} />
                <SortH label="Merchant ref" k="ref" tx={tx} setTx={setTx} />
                <SortH label="Type" k="type" tx={tx} setTx={setTx} />
                <SortH label="Gross" k="gross" tx={tx} setTx={setTx} right />
                <SortH label="Settled" k="settled" tx={tx} setTx={setTx} right />
                <SortH label="Fees" k="fees" tx={tx} setTx={setTx} right />
                <SortH label="Discrepancy" k="disc" tx={tx} setTx={setTx} right />
                <SortH label="Category" k="category" tx={tx} setTx={setTx} />
                <span role="columnheader" />
              </div>
              {ledgerRows.length === 0 && orphanRows.length === 0 && <div style={{ padding: '26px 16px', color: '#9aa3b0' }}>No transactions match.</div>}
              {ledgerRows.concat(orphanRows).map((r) =>
                renderRow(
                  r.id,
                  LCOLS,
                  [
                    cell(r.ledger ? r.ledger.id : shortRefOf(r.settlements[0].ref)),
                    cell(r.ledger ? r.ledger.capturedAt : 'no ledger', { color: INK2, size: 12 }),
                    cell(r.merchantId, { color: INK2, size: 12 }),
                    cell(r.ledger ? r.ledger.merchantRef || '—' : r.settlements[0].merchantRef || '—', { color: INK2, size: 12 }),
                    cell(r.ledger ? (r.ledger.type === 'SALE' ? 'Sale' : 'Refund') : '—', { sans: true, size: 12, color: r.ledger && r.ledger.type === 'REFUND' ? NEG : INK2 }),
                    cell(r.ledger ? fmt(r.ledger.gross) : '—', { right: true }),
                    cell(r.settlements.length ? fmt(r.rowActual) : '—', { right: true }),
                    cell(fmt(r.rowFees), { right: true, color: INK2 }),
                    cell(sfmt(r.rowImpact), { right: true, weight: 500, color: impCol(r.rowImpact) }),
                    cell(getCategory(r.category).label, { sans: true, size: 12, color: SEV_COLOR[getCategory(r.category).sev] }),
                    cell(expanded === r.id ? '▴' : '▾', { color: '#9aa3b0' }),
                  ],
                  r,
                ),
              )}
            </>
          )}

          <div role="row" style={{ display: 'grid', gridTemplateColumns: settleCentric ? SCOLS : LCOLS, gap: 8, padding: '11px 16px', borderTop: `1px solid ${C.borderStrong}`, background: C.surfaceAlt, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
            <span role="cell" style={{ fontFamily: SANS }}>Total ({settleCentric ? settleRows.length : txVisible.length})</span>
            <span /><span /><span /><span />
            <span role="cell" style={{ textAlign: 'right' }}>{fmt(txGross)}</span>
            <span role="cell" style={{ textAlign: 'right' }}>{fmt(txSettled)}</span>
            <span role="cell" style={{ textAlign: 'right' }}>{fmt(txFees)}</span>
            <span role="cell" style={{ textAlign: 'right', color: impCol(txImpact) }}>{sfmt(txImpact)}</span>
            <span /><span />
          </div>
        </div>
        <p style={{ margin: 0, padding: '10px 16px', borderTop: `1px solid ${C.borderSoft}`, fontSize: 11, color: tieOk ? '#9aa3b0' : NEG }}>
          {txAll ? (tieOk ? `All ${txVisible.length} included rows — impact sums to ${sfmt(txImpact)}, matching the headline discrepancy.` : `Impact sums to ${sfmt(txImpact)} but the headline discrepancy is ${sfmt(f.discrepancy)} — the report has a bug.`) : `Filtered view — totals cover the ${txVisible.length} visible rows, not the full dataset.`}
          {' '}Quarantined records are excluded — see the Quarantine tab.
        </p>
      </div>
    </section>
  );
}
