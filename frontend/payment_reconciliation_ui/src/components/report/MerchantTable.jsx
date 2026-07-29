import React, { useState } from 'react';
import { merchantRollup, figures } from '../../domain/selectors.js';
import { fmt, sfmt, dec, downloadCsv } from '../../domain/format.js';
import { C, MONO, SANS, INK, INK2 } from '../../styles/tokens.js';
import { HoverRow, GhostButton } from '../common.jsx';

const COLS = 'minmax(110px, 1fr) minmax(88px, 0.9fr) minmax(88px, 0.9fr) minmax(76px, 0.8fr) minmax(96px, 1fr) minmax(96px, 1fr) minmax(104px, 1.05fr) minmax(62px, 0.6fr) minmax(84px, 0.8fr)';
const rowPad = '10px';

const Head = ({ children, right, title }) => (
  <span role="columnheader" title={title} style={{ textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' }}>
    {children}
  </span>
);
const Num = ({ children, color }) => (
  <span role="cell" style={{ whiteSpace: 'nowrap', textAlign: 'right', color }}>
    {children}
  </span>
);

export default function MerchantTable({ model, nav, flash }) {
  const [breaksOnly, setBreaksOnly] = useState(true);
  const { rows: all, quarTotal } = merchantRollup(model);
  const f = figures(model);
  const rows = breaksOnly ? all.filter((m) => m.hasBreaks) : all;

  const exportCsv = () => {
    const n = downloadCsv(
      'merchant-rollup.csv',
      ['Merchant', 'Sales', 'Refunds', 'Fees', 'Exp pay', 'Settled', 'Discrepancy', 'Breaks', 'Quarantine'],
      rows.map((m) =>
        m.raw.quarantineOnly
          ? [m.merchantId, 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', m.raw.quar]
          : [m.merchantId, dec(m.raw.sales), dec(-m.raw.refunds), dec(-m.raw.fees), dec(m.raw.expected), dec(m.raw.settled), dec(m.raw.disc), m.raw.breaks, m.raw.quar],
      ),
    );
    flash(`merchant-rollup.csv — ${n} rows exported`);
  };

  return (
    <section style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Per-merchant rollup</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7b8697' }}>
            Unioned across both sides — a merchant with only an unmatched settlement still appears. Click a row to filter the break list.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: INK2, cursor: 'pointer' }}>
            <input type="checkbox" checked={breaksOnly} onChange={() => setBreaksOnly((v) => !v)} style={{ accentColor: '#2f5fd0' }} />
            Only merchants with breaks
          </label>
          <GhostButton onClick={exportCsv}>Export CSV</GhostButton>
        </div>
      </div>

      <div role="table" aria-label="Per-merchant rollup" style={{ fontSize: 13 }}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '9px 18px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7b8697' }}>
          <Head>Merchant</Head>
          <Head right>Sales</Head>
          <Head right>Refunds</Head>
          <Head right>Fees</Head>
          <Head right title="Expected payout — sales − refunds − fees">Exp pay</Head>
          <Head right>Settled</Head>
          <Head right>Discrepancy</Head>
          <Head right>Breaks</Head>
          <Head right>Quarantine</Head>
        </div>

        {rows.length === 0 && (
          <div style={{ padding: '22px 18px', color: '#9aa3b0', fontSize: 13 }}>No merchants with breaks. Untoggle the filter to see all merchants.</div>
        )}

        {rows.map((m) => (
          <HoverRow
            key={m.merchantId}
            role="row"
            onClick={() => (m.raw.quarantineOnly ? nav.toQuarantine() : nav.toBreaks({ merchantFilter: m.merchantId, catFilter: [] }))}
            style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: `${rowPad} 18px`, borderBottom: `1px solid ${C.rowRule}`, cursor: 'pointer', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', opacity: m.opacity }}
            hoverStyle={{ background: C.hover }}
          >
            <span role="cell" style={{ color: INK }}>{m.merchantId}</span>
            <Num color={INK}>{m.sales}</Num>
            <Num color={INK}>{m.refunds}</Num>
            <Num color={INK2}>{m.fees}</Num>
            <Num color={INK}>{m.expected}</Num>
            <Num color={INK}>{m.settled}</Num>
            <span role="cell" style={{ whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 500, color: m.discColor }}>{m.discrepancy}</span>
            <Num color={m.breakColor}>{m.breaks}</Num>
            <Num color={m.quarColor}>{m.quarantine}</Num>
          </HoverRow>
        ))}

        <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '11px 18px', borderTop: `1px solid ${C.borderStrong}`, background: C.surfaceAlt, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
          <span role="cell" style={{ fontFamily: SANS }}>Total</span>
          <Num color={INK}>{fmt(f.sales)}</Num>
          <Num color={INK}>{fmt(f.refunds)}</Num>
          <Num color={INK}>{fmt(f.fees)}</Num>
          <Num color={INK}>{fmt(f.expected)}</Num>
          <Num color={INK}>{fmt(f.actual)}</Num>
          <Num color={INK2}>{sfmt(f.discrepancy)}</Num>
          <Num color={INK}>{f.breakCount}</Num>
          <Num color={INK}>{quarTotal}</Num>
        </div>
      </div>
      <p style={{ margin: 0, padding: '12px 18px', borderTop: `1px solid ${C.borderSoft}`, fontSize: 11, color: '#9aa3b0', textWrap: 'pretty' }}>
        Quarantined records count only in the Quarantine column — they never touch sales, refunds, fees, expected, settled or discrepancy. A merchant whose records are all quarantined reads N/A across those columns.
      </p>
    </section>
  );
}
