import React, { useRef } from 'react';
import { merchantRollup, matchMerchantAll } from '../../domain/selectors.js';
import { fmt, sfmt, neg, dec, downloadCsv } from '../../domain/format.js';
import { C, INK } from '../../styles/tokens.js';
import { useColumns } from '../../styles/columns.js';
import { bodyRow, headerRow, totalRow, totalLabel, rowRule, discColor, deductionColor } from '../../styles/table.js';
import { HoverRow, GhostButton, SegGroup, FilterStrip } from '../common.jsx';
import { HeadCell, Num, EmptyState, TableFooter, GlyphKey } from './TableParts.jsx';

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
  const { template: COLS, gap: GAP, cell } = useColumns(tableRef, SPEC);
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
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Per-merchant rollup</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
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
            <span style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Show</span>
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
        <div role="row" style={headerRow(COLS, GAP)}>
          <HeadCell style={cell('merchant')}>Merchant</HeadCell>
          <HeadCell style={cell('sales')}>Sales</HeadCell>
          <HeadCell style={cell('refunds')}>Refunds</HeadCell>
          <HeadCell style={cell('interchange')} title="Interchange fees">Interchg</HeadCell>
          <HeadCell style={cell('processor')} title="Processor fees">Proc</HeadCell>
          <HeadCell style={cell('fees')} title="Total fees — interchange + processor">Fees</HeadCell>
          <HeadCell style={cell('expected')} title="Expected payout — sales − refunds − fees">Exp pay</HeadCell>
          <HeadCell style={cell('settled')}>Settled</HeadCell>
          <HeadCell style={cell('discrepancy')}>Discrepancy</HeadCell>
          <HeadCell style={cell('clean')} title="Cleanly matched records">Clean</HeadCell>
          <HeadCell style={cell('breaks')}>Breaks</HeadCell>
          <HeadCell style={cell('quarantine')}>Quarantine</HeadCell>
        </div>

        {rows.length === 0 && <EmptyState>No merchants match these filters.</EmptyState>}

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
            style={{ ...bodyRow(COLS, GAP), ...rowRule }}
            hoverStyle={{ background: C.hover }}
          >
            {/* The merchant id is this row's identity, so it keeps full ink at the table's
                base size — the treatment Transactions gives its own id column. */}
            <span role="cell" style={{ ...cell('merchant'), color: INK }}>{m.merchantId}</span>
            <Num style={cell('sales')} color={INK}>{m.sales}</Num>
            {/* A quarantine-only merchant reads N/A here, and `deductionColor(0)` keeps it
                neutral — the same neutral a genuine zero gets. */}
            <Num style={cell('refunds')} color={deductionColor(m.raw.refunds)}>{m.refunds}</Num>
            <Num style={cell('interchange')} color={deductionColor(m.raw.interchange)}>{m.interchange}</Num>
            <Num style={cell('processor')} color={deductionColor(m.raw.processor)}>{m.processor}</Num>
            <Num style={cell('fees')} color={deductionColor(m.raw.fees)}>{m.fees}</Num>
            <Num style={cell('expected')} color={INK}>{m.expected}</Num>
            <Num style={cell('settled')} color={INK}>{m.settled}</Num>
            {/* A quarantine-only row prints N/A over a raw disc of 0, which `discColor`
                already renders in normal ink — no special case needed. */}
            <Num style={{ ...cell('discrepancy'), fontWeight: 500 }} color={discColor(m.raw.disc)}>
              {m.discrepancy}
            </Num>
            <Num style={cell('clean')} color={INK}>{m.clean}</Num>
            <Num style={cell('breaks')} color={INK}>{m.breaks}</Num>
            <Num style={cell('quarantine')} color={INK}>{m.quarantine}</Num>
          </HoverRow>
        ))}

        <div role="row" style={totalRow(COLS, GAP)}>
          <span role="cell" style={totalLabel}>
            {filtered ? `Total — ${rows.length} of ${all.length} merchants` : 'Total'}
          </span>
          <Num style={cell('sales')} color={INK}>{fmt(t.sales)}</Num>
          <Num style={cell('refunds')} color={deductionColor(t.refunds)}>{neg(t.refunds)}</Num>
          <Num style={cell('interchange')} color={deductionColor(t.interchange)}>{neg(t.interchange)}</Num>
          <Num style={cell('processor')} color={deductionColor(t.processor)}>{neg(t.processor)}</Num>
          <Num style={cell('fees')} color={deductionColor(t.fees)}>{neg(t.fees)}</Num>
          <Num style={cell('expected')} color={INK}>{fmt(t.expected)}</Num>
          <Num style={cell('settled')} color={INK}>{fmt(t.settled)}</Num>
          <Num style={cell('discrepancy')} color={discColor(t.disc)}>{sfmt(t.disc)}</Num>
          <Num style={cell('clean')} color={INK}>{t.clean}</Num>
          <Num style={cell('breaks')} color={INK}>{t.breaks}</Num>
          <Num style={cell('quarantine')} color={INK}>{t.quar}</Num>
        </div>
      </div>
      <TableFooter
        left={<span style={{ textWrap: 'pretty' }}>Quarantined records count only in the Quarantine column — they never touch sales, refunds, fees, expected, settled or discrepancy. A merchant whose records are all quarantined reads N/A across those columns.</span>}
        legend={<GlyphKey keys={['na']} />}
      />
    </section>
  );
}
