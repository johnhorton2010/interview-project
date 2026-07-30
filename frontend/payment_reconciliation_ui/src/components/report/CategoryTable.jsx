import React, { useRef } from 'react';
import { categorySummary, figures } from '../../domain/selectors.js';
import { dec, downloadCsv } from '../../domain/format.js';
import { C, MONO, SANS, INK, NEG, POS } from '../../styles/tokens.js';
import { useColumns } from '../../styles/columns.js';
import { HoverRow, SevDot, GhostButton } from '../common.jsx';

const SPEC = [
  { key: 'category', min: 120 },
  { key: 'severity', min: 56 },
  { key: 'totalCount', min: 40, align: 'right' },
  { key: 'sides', min: 48, align: 'right' },
  { key: 'sales', min: 64, align: 'right' },
  { key: 'refunds', min: 64, align: 'right' },
  { key: 'fees', min: 64, align: 'right' },
  { key: 'expected', min: 64, align: 'right' },
  { key: 'settled', min: 64, align: 'right' },
  { key: 'impact', min: 64, align: 'right' },
];
const rowPad = '10px';

const HeadCell = ({ children, right, title }) => (
  <span
    role="columnheader"
    title={title}
    style={{ textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' }}
  >
    {children}
  </span>
);

const Num = ({ children, color }) => (
  <span role="cell" style={{ whiteSpace: 'nowrap', textAlign: 'right', color }}>
    {children}
  </span>
);

export default function CategoryTable({ model, nav, flash }) {
  const tableRef = useRef(null);
  const { template: COLS, gap: GAP } = useColumns(tableRef, SPEC);
  const { rows, totals } = categorySummary(model);
  // Footer discrepancy carries the same sign colour as the headline tile.
  const disc = figures(model).discrepancy;
  const discColor = disc === 0 ? INK : disc < 0 ? NEG : POS;

  const exportCsv = () => {
    const n = downloadCsv(
      'reconciliation-summary.csv',
      ['Category', 'Severity', 'Total n', 'Ledger n', 'Settle n', 'Sales', 'Refunds', 'Fees', 'Exp pay', 'Settled', 'Discrepancy'],
      rows.map((c) => [
        c.label,
        c.severity,
        c.totalCount,
        c.rawLedgerN,
        c.rawSettleN,
        dec(c.rawSales),
        dec(-c.rawRefunds),
        dec(-c.rawFees),
        c.isQuarantine ? 'N/A' : dec(c.rawSales - c.rawRefunds - c.rawFees),
        dec(c.rawSettled),
        c.isQuarantine ? 'N/A' : dec(c.rawImpact),
      ]),
    );
    flash(`reconciliation-summary.csv — ${n} rows exported`);
  };

  const onRow = (c) => {
    if (c.isQuarantine) return nav.toQuarantine();
    if (c.key === 'CLEAN_MATCH') return nav.toTransactions({ txCats: [c.key], txType: 'all', txQuery: '' });
    return nav.toBreaks({ catFilter: [c.key], merchantFilter: null });
  };

  return (
    <section style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Reconciliation summary</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7b8697' }}>
            Both sides are reported: one amount column would be ambiguous where a ledger row faces two settlements. Click a row to filter the break list.
          </p>
        </div>
        <GhostButton onClick={exportCsv}>Export CSV</GhostButton>
      </div>

      <div ref={tableRef} role="table" aria-label="Reconciliation summary" style={{ fontSize: 13 }}>
        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns: COLS,
            gap: GAP,
            padding: '9px 18px',
            borderBottom: `1px solid ${C.border}`,
            background: C.surfaceAlt,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#7b8697',
          }}
        >
          <HeadCell>Category</HeadCell>
          <HeadCell>Severity</HeadCell>
          <HeadCell right>Total n</HeadCell>
          <HeadCell right title="Ledger-side records / settlement-side records">Ldgr / Stl</HeadCell>
          <HeadCell right>Sales</HeadCell>
          <HeadCell right>Refunds</HeadCell>
          <HeadCell right>Fees</HeadCell>
          <HeadCell right title="Expected payout — sales − refunds − fees">Exp pay</HeadCell>
          <HeadCell right>Settled</HeadCell>
          <HeadCell right>Discrepancy</HeadCell>
        </div>

        {rows.map((c) => {
          // A muted row overrides every cell colour with one flat, AA-compliant ink; the
          // tint above carries the de-emphasis that opacity used to.
          const ink = (fallback) => c.rowInk || fallback;
          return (
          <HoverRow
            key={c.key}
            role="row"
            onClick={() => onRow(c)}
            style={{
              display: 'grid',
              gridTemplateColumns: COLS,
              gap: GAP,
              padding: `${rowPad} 18px`,
              borderBottom: `1px solid ${C.rowRule}`,
              cursor: 'pointer',
              background: c.bg,
              // Cells without an explicit colour (the category label) inherit this.
              color: c.rowInk || undefined,
              fontFamily: MONO,
              fontVariantNumeric: 'tabular-nums',
            }}
            hoverStyle={{ background: C.hover }}
          >
            <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, fontFamily: SANS }}>
              <SevDot color={c.sevColor} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
            </span>
            <span role="cell" style={{ display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: SANS,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: ink(c.sevColor),
                  border: `1px solid ${c.sevBorder}`,
                  background: c.sevBg,
                  borderRadius: 3,
                  padding: '1px 5px',
                }}
              >
                {c.severity}
              </span>
            </span>
            <Num color={ink(c.dimColor)}>{c.totalCount}</Num>
            <Num color={ink(c.dimColor)}>{c.sides}</Num>
            <Num color={ink(c.salesColor)}>{c.sales}</Num>
            <Num color={ink(c.refundColor)}>{c.refunds}</Num>
            <Num color={ink(c.feeColor)}>{c.fees}</Num>
            <Num color={ink(INK)}>{c.expected}</Num>
            <Num color={ink(c.settledColor)}>{c.settled}</Num>
            <span role="cell" style={{ whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 500, color: ink(c.impactColor) }}>
              {c.impact}
            </span>
          </HoverRow>
          );
        })}

        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns: COLS,
            gap: GAP,
            padding: '11px 18px',
            borderTop: `1px solid ${C.borderStrong}`,
            background: C.surfaceAlt,
            fontFamily: MONO,
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 500,
          }}
        >
          <span role="cell" style={{ textAlign: 'left', fontFamily: SANS }}>Total — included records only</span>
          <span role="cell" />
          <Num color={INK}>{totals.totalCount}</Num>
          <Num color={INK}>{totals.sides}</Num>
          <Num color={INK}>{totals.sales}</Num>
          <Num color={INK}>{totals.refunds}</Num>
          <Num color={INK}>{totals.fees}</Num>
          <Num color={INK}>{totals.expected}</Num>
          <Num color={INK}>{totals.settled}</Num>
          <Num color={discColor}>{totals.discrepancy}</Num>
        </div>
      </div>
    </section>
  );
}
