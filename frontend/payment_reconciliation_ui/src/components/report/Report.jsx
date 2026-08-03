import React, { useState } from 'react';
import { figures, merchantRollup } from '../../domain/selectors.js';
import { fmt, sfmt } from '../../domain/format.js';
import { C, MONO, INK, INK2, NEG, POS, ACCENT } from '../../styles/tokens.js';
import { HoverRow, Btn } from '../common.jsx';
import CategoryTable from './CategoryTable.jsx';
import MerchantTable from './MerchantTable.jsx';
import BreaksTab from './BreaksTab.jsx';
import TransactionsTab from './TransactionsTab.jsx';
import QuarantineTab from './QuarantineTab.jsx';

function Tile({ children, onClick, style }) {
  if (onClick) {
    return (
      <HoverRow as="button" type="button" onClick={onClick} style={{ textAlign: 'left', cursor: 'pointer', ...style }} hoverStyle={{ borderColor: '#9aa3b0' }}>
        {children}
      </HoverRow>
    );
  }
  return <div style={style}>{children}</div>;
}

function TabButton({ label, active, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{ border: 0, background: 'none', padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: active ? INK : INK2, fontWeight: active ? 600 : 400, boxShadow: `inset 0 -2px 0 ${active ? ACCENT : 'transparent'}` }}
    >
      {label}
    </button>
  );
}

function PayoutPanel({ model, nav }) {
  const [feesOpen, setFeesOpen] = useState(false);
  const f = figures(model);
  const max = f.sales || 1;
  const bar = (v, from) => ({ left: (from / max) * 100, width: (Math.abs(v) / max) * 100 });

  // Per-term tooltips, matching the design's `linkTitle` values.
  const nRows = model.included.length;
  const nSales = model.included.filter((r) => r.ledger && r.ledger.type === 'SALE').length;
  const nRefunds = model.included.filter((r) => r.ledger && r.ledger.type === 'REFUND').length;
  const FEE_TITLE = 'Open each settlement — the settlement view itemises interchange and processor fees';

  const terms = [
    { label: 'Gross sales', value: fmt(f.sales), color: INK, barColor: '#9fb4d9', bar: bar(f.sales, 0), rule: 'transparent', title: `Open the ${nSales} sale rows behind this figure`, onClick: () => nav.toTransactions({ type: 'SALE', sortKey: 'sales' }) },
    // Refunds sort ascending: their amounts are negative, so ascending puts the largest
    // refund first — which is what someone opening this figure came to see.
    { label: 'Less gross refunds', value: '−' + fmt(f.refunds), color: NEG, barColor: '#e2b3b5', bar: bar(f.refunds, f.sales - f.refunds), title: `Open the ${nRefunds} refund rows behind this figure`, onClick: () => nav.toTransactions({ type: 'REFUND', sortKey: 'refunds', sortDir: 'asc' }) },
    { label: 'Less total fees', value: '−' + fmt(f.fees), color: NEG, barColor: '#e2b3b5', bar: bar(f.fees, f.expected), toggle: true, title: `Open all ${nRows} rows sorted by fees charged`, onClick: () => nav.toTransactions({ sortKey: 'fees' }) },
  ];
  if (feesOpen) {
    terms.push({ label: '   Interchange fees', value: '−' + fmt(f.interchange), color: INK2, barColor: '#c3cede', bar: bar(f.interchange, f.expected), title: FEE_TITLE, onClick: () => nav.toTransactions({ view: 'settlement', sortKey: 'fees' }) });
    terms.push({ label: '   Processor fees', value: '−' + fmt(f.processor), color: INK2, barColor: '#c3cede', bar: bar(f.processor, f.expected), title: FEE_TITLE, onClick: () => nav.toTransactions({ view: 'settlement', sortKey: 'fees' }) });
  }
  terms.push({ label: 'Expected payout', value: fmt(f.expected), color: INK, strong: true, barColor: ACCENT, bar: bar(f.expected, 0), rule: C.borderStrong, title: `Open all ${nRows} reconciled rows this figure is derived from`, onClick: () => nav.toTransactions({}) });
  terms.push({ label: 'Actual settled', value: fmt(f.actual), color: INK, barColor: '#7f8b9d', bar: bar(f.actual, 0), title: `Open the ${f.includedSettle} settlements that sum to this figure`, onClick: () => nav.toTransactions({ view: 'settlement', sortKey: 'settled' }) });
  terms.push({ label: 'Total discrepancy', value: sfmt(f.discrepancy), color: f.discrepancy === 0 ? INK : f.discrepancy < 0 ? NEG : POS, strong: true, barColor: f.discrepancy < 0 ? NEG : POS, bar: bar(f.discrepancy, Math.min(f.expected, f.actual)), rule: C.borderStrong, title: `Open all ${f.breakCount} breaks`, onClick: () => nav.toBreaks() });

  return (
    <section aria-label="Payout derivation" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px 20px 20px', marginBottom: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Expected Payout vs. Actual Settled</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7b8697' }}>Every total can be clicked to view the transactions backing the calculation.</p>
      </div>
      <div style={{ maxWidth: 780 }}>
        {terms.map((t, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 130px', gap: 16, alignItems: 'center', padding: '9px 0', borderTop: `1px solid ${t.rule || C.rowRule}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: t.strong ? 13 : 12, fontWeight: t.strong ? 600 : 400, color: t.strong ? INK : INK2, whiteSpace: 'pre' }}>{t.label}</span>
              {t.toggle && (
                <button type="button" onClick={() => setFeesOpen((v) => !v)} style={{ border: 0, background: 'none', padding: 0, fontSize: 11, color: ACCENT, cursor: 'pointer' }}>
                  {feesOpen ? 'hide split' : 'show split'}
                </button>
              )}
            </div>
            <div style={{ height: 6, background: C.pageBg, borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${t.bar.left}%`, width: `${t.bar.width}%`, background: t.barColor, borderRadius: 3 }} />
            </div>
            <Btn onClick={t.onClick} title={t.title} style={{ border: 0, background: 'none', padding: 0, textAlign: 'right', fontFamily: MONO, fontSize: t.strong ? 16 : 13, fontWeight: t.strong ? 600 : 400, fontVariantNumeric: 'tabular-nums', color: t.color, cursor: 'pointer' }} hoverStyle={{ textDecoration: 'underline' }}>
              {t.value}
            </Btn>
          </div>
        ))}
      </div>
      <p style={{ margin: '16px 0 0', fontSize: 11, color: '#9aa3b0', textWrap: 'pretty' }}>
        A positive discrepancy means the processor settled less than expected (money owed to us) and a negative discrepancy means it settled more.
      </p>
    </section>
  );
}

function Report({ model, tab, nav, br, setBr, tx, setTx, mr, setMr, expanded, setExpanded, stale, onRun, dismissStale, flash }) {
  const f = figures(model);
  // The whole roster, not the filtered view — tab counts report the dataset, the way
  // Breaks shows every break and Quarantine every withheld record.
  const merchantCount = merchantRollup(model).rows.length;
  const discColor = f.discrepancy === 0 ? INK : f.discrepancy < 0 ? NEG : POS;
  const discTileBg = f.discrepancy === 0 ? '#fff' : f.discrepancy < 0 ? '#fdf5f5' : '#f3faf6';
  const discTileBorder = f.discrepancy === 0 ? C.border : f.discrepancy < 0 ? '#f2d2d2' : '#cfe6da';
  const discNote = f.discrepancy === 0 ? 'balanced' : f.discrepancy < 0 ? 'Processor settled more than expected.' : 'Processor settled less than expected.';

  const tileBase = { borderRadius: 8, padding: '14px 16px' };

  return (
    <main style={{ padding: '22px 28px 80px' }}>
      {stale && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 18, background: '#fdf4e3', border: '1px solid #f0dfb8', borderRadius: 7, fontSize: 13, color: '#7a5100' }}>
          <span style={{ flex: 1 }}>You have imported data since the last reconciliation. Run reconciliation to refresh this report.</span>
          <Btn onClick={onRun} style={{ border: '1px solid #d9be7e', background: '#fff', color: '#7a5100', padding: '5px 10px', fontSize: 12, borderRadius: 5, cursor: 'pointer' }} hoverStyle={{ background: '#fff8ec' }}>Run reconciliation</Btn>
          <button type="button" aria-label="Dismiss" onClick={dismissStale} style={{ border: 0, background: 'none', color: '#a78650', fontSize: 15, cursor: 'pointer', padding: '0 2px' }}>×</button>
        </div>
      )}

      <section aria-label="Headline figures" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Tile onClick={() => nav.toQuarantine()} style={{ ...tileBase, background: '#f7f8fa', border: '1px dashed #cfd6e0' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#7b8697', marginBottom: 8 }}>Quarantined</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: INK2 }}>{f.quarantineCount}</span>
            <span style={{ fontSize: 12, color: INK2 }}>records</span>
          </div>
          <div style={{ fontSize: 11, color: '#7b8697', marginTop: 6 }}>Excluded from every calculation on this report. Click to see records.</div>
        </Tile>

        <Tile style={{ ...tileBase, background: discTileBg, border: `1px solid ${discTileBorder}` }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#7b8697', marginBottom: 8 }}>Total discrepancy</div>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', color: discColor }}>{sfmt(f.discrepancy)}</div>
          <div style={{ fontSize: 11, color: '#7b8697', marginTop: 6 }}>{discNote}</div>
        </Tile>

        <Tile onClick={() => nav.toBreaks()} style={{ ...tileBase, background: '#fff', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#7b8697', marginBottom: 8 }}>Breaks</div>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{f.breakCount}</div>
          <div style={{ fontSize: 11, color: '#7b8697', marginTop: 6 }}>Click to see records.</div>
        </Tile>
      </section>

      <PayoutPanel model={model} nav={nav} />

      <nav id="report-tabs" aria-label="Report sections" style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        <TabButton label="Summary" active={tab === 'categories'} onClick={() => nav.goTab('categories')} />
        <TabButton label={`Merchants · ${merchantCount}`} active={tab === 'merchants'} onClick={() => nav.goTab('merchants')} />
        <TabButton label={`Breaks · ${f.breakCount}`} active={tab === 'breaks'} onClick={() => nav.goTab('breaks')} />
        {/* Non-quarantined records per side, not row count — the same pair the
            Summary table shows under Ldgr / Stl. */}
        <TabButton
          label={`Transactions · ${f.includedLedger}/${f.includedSettle}`}
          title="Ledger-side records / settlement-side records"
          active={tab === 'transactions'}
          onClick={() => nav.goTab('transactions')}
        />
        <TabButton label={`Quarantine · ${f.quarantineCount}`} active={tab === 'quarantine'} onClick={() => nav.goTab('quarantine')} />
      </nav>

      {tab === 'categories' && <CategoryTable model={model} nav={nav} flash={flash} />}
      {tab === 'merchants' && <MerchantTable model={model} nav={nav} mr={mr} setMr={setMr} flash={flash} />}
      {tab === 'breaks' && <BreaksTab model={model} br={br} setBr={setBr} expanded={expanded} setExpanded={setExpanded} flash={flash} />}
      {tab === 'transactions' && <TransactionsTab model={model} tx={tx} setTx={setTx} expanded={expanded} setExpanded={setExpanded} flash={flash} />}
      {tab === 'quarantine' && <QuarantineTab model={model} expanded={expanded} setExpanded={setExpanded} flash={flash} />}
    </main>
  );
}

// Memoized because App owns state this report does not read — chiefly `toast`, which is
// set and cleared on every copy-to-clipboard. Without this, one click on a copy button
// re-rendered every row of the open table twice, 2.4 seconds apart. App holds every prop
// below at a stable identity for exactly this reason.
export default React.memo(Report);
