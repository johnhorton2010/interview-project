import React, { useRef } from 'react';
import { merchantRollup, matchMerchantAll } from '../../domain/selectors.js';
import { fmt, sfmt, dec, downloadCsv } from '../../domain/format.js';
import { C, MONO, SANS, INK, INK2, NEG, POS } from '../../styles/tokens.js';
import { useColumns } from '../../styles/columns.js';
import { HoverRow, GhostButton, SegGroup, FilterStrip } from '../common.jsx';

const SPEC = [
  { key: 'merchant', min: 72 },
  { key: 'sales', min: 64, align: 'right' },
  { key: 'refunds', min: 64, align: 'right' },
  // Parts before their total: INTERCHG + PROC = FEES, then SALES − REFUNDS − FEES = EXP
  // PAY, so every total in the row follows its own inputs.
  { key: 'interchange', min: 64, align: 'right' },
  { key: 'processor', min: 56, align: 'right' },
  { key: 'fees', min: 48, align: 'right' },
  { key: 'expected', min: 64, align: 'right' },
  { key: 'settled', min: 64, align: 'right' },
  { key: 'discrepancy', min: 64, align: 'right' },
  { key: 'clean', min: 40, align: 'right' },
  { key: 'breaks', min: 40, align: 'right' },
  { key: 'quarantine', min: 56, align: 'right' },
];
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

// Search grammar for this tab. Narrower than Breaks or Transactions on purpose: a
// rollup row has no ids, refs, dates or category — only a merchant and its money.
const SEARCH_TITLE =
  'Terms are combined with AND. Plain text matches the merchant id. A decimal matches any ' +
  'money column — sales, refunds, interchange, processor, fees, expected pay, settled or discrepancy.';

// `mr` is owned by App, not held here: this component unmounts on every tab switch, so
// local state would forget a deliberate filter each time you left.
export default function MerchantTable({ model, nav, mr, setMr, flash }) {
  const { query, breaksOnly } = mr;
  const tableRef = useRef(null);
  const { template: COLS, gap: GAP } = useColumns(tableRef, SPEC);
  const { rows: all } = merchantRollup(model);
  const rows = all.filter((m) => (!breaksOnly || m.hasBreaks) && matchMerchantAll(m, query));

  const filterBits = [];
  if (breaksOnly) filterBits.push('show: Breaks only');
  if (query.trim()) filterBits.push('search: "' + query.trim() + '"');

  // The Total reflects what is on screen, not the whole model, so a filtered table never
  // shows a total its own rows do not add up to. Quarantine-only merchants sum harmlessly:
  // every money field is 0 and only `quar` is non-zero.
  const KEYS = ['sales', 'refunds', 'interchange', 'processor', 'fees', 'expected', 'settled', 'disc', 'clean', 'breaks', 'quar'];
  const t = rows.reduce(
    (acc, m) => Object.fromEntries(KEYS.map((k) => [k, acc[k] + m.raw[k]])),
    Object.fromEntries(KEYS.map((k) => [k, 0])),
  );
  const filtered = rows.length < all.length;

  const exportCsv = () => {
    const n = downloadCsv(
      'merchant-rollup.csv',
      ['Merchant', 'Sales', 'Refunds', 'Interchange', 'Processor', 'Fees', 'Exp pay', 'Settled', 'Discrepancy', 'Clean', 'Breaks', 'Quarantine'],
      rows.map((m) =>
        m.raw.quarantineOnly
          ? [m.merchantId, 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', m.raw.quar]
          : [m.merchantId, dec(m.raw.sales), dec(-m.raw.refunds), dec(-m.raw.interchange), dec(-m.raw.processor), dec(-m.raw.fees), dec(m.raw.expected), dec(m.raw.settled), dec(m.raw.disc), m.raw.clean, m.raw.breaks, m.raw.quar],
      ),
    );
    flash(`merchant-rollup.csv — ${n} rows exported`);
  };

  return (
    <section style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Per-merchant rollup</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7b8697' }}>
            Click a row to filter the break list, to open Transactions when a merchant has no breaks, or Quarantine when its records are all quarantined.
          </p>
          <input
            type="search"
            value={query}
            onChange={(e) => setMr((m) => ({ ...m, query: e.target.value }))}
            placeholder="Search merchant or amount — e.g. MERCH-004 or 1186.63"
            title={SEARCH_TITLE}
            style={{ display: 'block', width: '100%', marginTop: 10, padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, color: INK, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#9aa3b0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Show</span>
            <SegGroup
              options={[
                { label: 'All', on: !breaksOnly, title: 'Every merchant in the report', onClick: () => setMr((m) => ({ ...m, breaksOnly: false })) },
                { label: 'Breaks only', on: breaksOnly, title: 'Only merchants with at least one break', onClick: () => setMr((m) => ({ ...m, breaksOnly: true })) },
              ]}
            />
          </div>
          <GhostButton onClick={exportCsv}>Export CSV</GhostButton>
        </div>
      </div>

      <FilterStrip bits={filterBits} onClear={() => setMr((m) => ({ ...m, query: '', breaksOnly: false }))} />

      <div ref={tableRef} role="table" aria-label="Per-merchant rollup" style={{ fontSize: 13 }}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: GAP, padding: '9px 18px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7b8697' }}>
          <Head>Merchant</Head>
          <Head right>Sales</Head>
          <Head right>Refunds</Head>
          <Head right title="Interchange fees">Interchg</Head>
          <Head right title="Processor fees">Proc</Head>
          <Head right title="Total fees — interchange + processor">Fees</Head>
          <Head right title="Expected payout — sales − refunds − fees">Exp pay</Head>
          <Head right>Settled</Head>
          <Head right>Discrepancy</Head>
          <Head right title="Cleanly matched records">Clean</Head>
          <Head right>Breaks</Head>
          <Head right>Quarantine</Head>
        </div>

        {rows.length === 0 && (
          <div style={{ padding: '22px 18px', color: '#9aa3b0', fontSize: 13 }}>No merchants match these filters.</div>
        )}

        {rows.map((m) => (
          <HoverRow
            key={m.merchantId}
            role="row"
            // Three destinations, each the place this merchant's records actually are:
            // all-quarantined → Quarantine, has breaks → the filtered break list, and
            // otherwise → Transactions. That last case has included rows but no breaks,
            // so sending it to Breaks would land on an empty list.
            onClick={() =>
              m.raw.quarantineOnly
                ? nav.toQuarantine()
                : m.hasBreaks
                  ? nav.toBreaks({ merchantFilter: m.merchantId, catFilter: [] })
                  : nav.toTransactions({ query: `merchant:${m.merchantId}` })
            }
            style={{ display: 'grid', gridTemplateColumns: COLS, gap: GAP, padding: `${rowPad} 18px`, borderBottom: `1px solid ${C.rowRule}`, cursor: 'pointer', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}
            hoverStyle={{ background: C.hover }}
          >
            <span role="cell" style={{ color: INK }}>{m.merchantId}</span>
            <Num color={INK}>{m.sales}</Num>
            <Num color={INK}>{m.refunds}</Num>
            <Num color={INK2}>{m.interchange}</Num>
            <Num color={INK2}>{m.processor}</Num>
            <Num color={INK2}>{m.fees}</Num>
            <Num color={INK}>{m.expected}</Num>
            <Num color={INK}>{m.settled}</Num>
            <span role="cell" style={{ whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 500, color: m.discColor }}>{m.discrepancy}</span>
            <Num color={INK}>{m.clean}</Num>
            <Num color={INK}>{m.breaks}</Num>
            <Num color={INK}>{m.quarantine}</Num>
          </HoverRow>
        ))}

        <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: GAP, padding: '11px 18px', borderTop: `1px solid ${C.borderStrong}`, background: C.surfaceAlt, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
          <span role="cell" style={{ fontFamily: SANS, whiteSpace: 'nowrap' }}>
            {filtered ? `Total — ${rows.length} of ${all.length} merchants` : 'Total'}
          </span>
          <Num color={INK}>{fmt(t.sales)}</Num>
          <Num color={INK}>{fmt(t.refunds)}</Num>
          <Num color={INK}>{fmt(t.interchange)}</Num>
          <Num color={INK}>{fmt(t.processor)}</Num>
          <Num color={INK}>{fmt(t.fees)}</Num>
          <Num color={INK}>{fmt(t.expected)}</Num>
          <Num color={INK}>{fmt(t.settled)}</Num>
          <Num color={t.disc === 0 ? INK : t.disc < 0 ? NEG : POS}>{sfmt(t.disc)}</Num>
          <Num color={INK}>{t.clean}</Num>
          <Num color={INK}>{t.breaks}</Num>
          <Num color={INK}>{t.quar}</Num>
        </div>
      </div>
      <p style={{ margin: 0, padding: '12px 18px', borderTop: `1px solid ${C.borderSoft}`, fontSize: 11, color: '#9aa3b0', textWrap: 'pretty' }}>
        Quarantined records count only in the Quarantine column — they never touch sales, refunds, fees, expected, settled or discrepancy. A merchant whose records are all quarantined reads N/A across those columns.
      </p>
    </section>
  );
}
