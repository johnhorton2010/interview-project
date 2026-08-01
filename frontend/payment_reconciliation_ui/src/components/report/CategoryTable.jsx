import React, { useRef } from 'react';
import { categorySummary, figures } from '../../domain/selectors.js';
import { dec, decNeg, downloadCsv } from '../../domain/format.js';
import { C, SANS, INK, INK2 } from '../../styles/tokens.js';
import { useColumns } from '../../styles/columns.js';
import { bodyRow, headerRow, totalRow, totalLabel, rowRule, discColor, deductionColor } from '../../styles/table.js';
import { HoverRow, SevDot, GhostButton } from '../common.jsx';
import { HeadCell, Num, TableFooter, GlyphKey } from './TableParts.jsx';
import { SUMMARY_HELP as HELP } from './columnHelp.js';
import { COL, EXPORT_COLUMNS, project } from './exportColumns.js';

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

export default function CategoryTable({ model, nav, flash }) {
  const tableRef = useRef(null);
  const { template: COLS, gap: GAP, cell } = useColumns(tableRef, SPEC);
  const { rows, totals } = categorySummary(model);
  // The total row prints `totals`, but its ink comes from the underlying cents.
  const f = figures(model);
  const disc = f.discrepancy;

  const exportCsv = () => {
    const n = downloadCsv(
      'reconciliation-summary.csv',
      EXPORT_COLUMNS.summary,
      rows.map((c) => {
        // Mirrors the table: the excluded row carries no monetary figure in either place.
        const money = (v) => (c.isQuarantine ? 'N/A' : v);
        return project(EXPORT_COLUMNS.summary, {
          [COL.category]: c.label,
          [COL.severity]: c.severity,
          [COL.totalN]: c.totalCount,
          [COL.ledgerN]: c.rawLedgerN,
          [COL.settleN]: c.rawSettleN,
          [COL.sales]: money(dec(c.rawSales)),
          [COL.refunds]: money(decNeg(c.rawRefunds)),
          [COL.fees]: money(decNeg(c.rawFees)),
          [COL.expected]: money(dec(c.rawSales - c.rawRefunds - c.rawFees)),
          [COL.settled]: money(dec(c.rawSettled)),
          [COL.discrepancy]: money(dec(c.rawImpact)),
        });
      }),
    );
    flash(`reconciliation-summary.csv — ${n} rows exported`);
  };

  const onRow = (c) => {
    if (c.isQuarantine) return nav.toQuarantine();
    // Keys must match the tx state shape (cats/type/query); `nav.toTransactions` already
    // resets type and query, so only the category filter needs passing.
    if (c.key === 'CLEAN_MATCH') return nav.toTransactions({ cats: [c.key] });
    return nav.toBreaks({ catFilter: [c.key], merchantFilter: null });
  };

  // Quarantined sits below the total, so split it out of the category list.
  const included = rows.filter((c) => !c.isQuarantine);
  const quarantined = rows.find((c) => c.isQuarantine);

  // Rendered for the included categories and, separately, for the quarantine row
  // below the total — one definition so the two can never drift apart.
  const renderRow = (c) => {
    // A muted row overrides every cell colour with one flat, AA-compliant ink; the
    // tint above carries the de-emphasis that opacity used to.
    const ink = (fallback) => c.rowInk || fallback;
    return (
    <HoverRow
      key={c.key}
      role="row"
      onClick={() => onRow(c)}
      style={{
        ...bodyRow(COLS, GAP),
        ...rowRule,
        background: c.bg,
        // Cells without an explicit colour (the category label) inherit this.
        color: c.rowInk || undefined,
      }}
      hoverStyle={{ background: C.hover }}
    >
      <span role="cell" style={{ ...cell('category'), display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, fontFamily: SANS }}>
        <SevDot color={c.sevColor} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
      </span>
      <span role="cell" style={{ ...cell('severity'), display: 'flex', alignItems: 'center' }}>
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
      {/* A quarantined category reads N/A across every money column, so `ink` overrides
          the sign colours below with the row's flat mute — those figures are not printed
          here at all, and colouring an N/A by a number you cannot see is noise. */}
      <Num style={cell('totalCount')} color={ink(INK2)}>{c.totalCount}</Num>
      <Num style={cell('sides')} color={ink(INK2)}>{c.sides}</Num>
      <Num style={cell('sales')} color={ink(INK)}>{c.sales}</Num>
      <Num style={cell('refunds')} color={ink(deductionColor(c.rawRefunds))}>{c.refunds}</Num>
      <Num style={cell('fees')} color={ink(deductionColor(c.rawFees))}>{c.fees}</Num>
      <Num style={cell('expected')} color={ink(INK)}>{c.expected}</Num>
      <Num style={cell('settled')} color={ink(INK)}>{c.settled}</Num>
      <Num style={{ ...cell('impact'), fontWeight: 500 }} color={ink(discColor(c.rawImpact))}>
        {c.impact}
      </Num>
    </HoverRow>
    );
  };

  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Reconciliation Summary</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
            Click a row to see backing transactions.
          </p>
        </div>
        <GhostButton onClick={exportCsv}>Export CSV</GhostButton>
      </div>

      <div ref={tableRef} role="table" aria-label="Reconciliation Summary" style={{ fontSize: 13 }}>
        <div role="row" style={headerRow(COLS, GAP)}>
          <HeadCell style={cell('category')} help={HELP.category}>Category</HeadCell>
          <HeadCell style={cell('severity')} help={HELP.severity}>Severity</HeadCell>
          <HeadCell style={cell('totalCount')} help={HELP.totalCount}>Total n</HeadCell>
          <HeadCell style={cell('sides')} help={HELP.sides}>Ldgr / Stl</HeadCell>
          <HeadCell style={cell('sales')} help={HELP.sales}>Sales</HeadCell>
          <HeadCell style={cell('refunds')} help={HELP.refunds}>Refunds</HeadCell>
          <HeadCell style={cell('fees')} help={HELP.fees}>Fees</HeadCell>
          <HeadCell style={cell('expected')} help={HELP.expected}>Exp pay</HeadCell>
          <HeadCell style={cell('settled')} help={HELP.settled}>Settled</HeadCell>
          <HeadCell style={cell('impact')} help={HELP.impact}>Discrepancy</HeadCell>
        </div>

        {included.map(renderRow)}

        <div role="row" style={totalRow(COLS, GAP)}>
          <span role="cell" style={totalLabel}>Total</span>
          <span role="cell" />
          <Num style={cell('totalCount')} color={INK}>{totals.totalCount}</Num>
          <Num style={cell('sides')} color={INK}>{totals.sides}</Num>
          <Num style={cell('sales')} color={INK}>{totals.sales}</Num>
          <Num style={cell('refunds')} color={deductionColor(f.refunds)}>{totals.refunds}</Num>
          <Num style={cell('fees')} color={deductionColor(f.fees)}>{totals.fees}</Num>
          <Num style={cell('expected')} color={INK}>{totals.expected}</Num>
          <Num style={cell('settled')} color={INK}>{totals.settled}</Num>
          <Num style={cell('impact')} color={discColor(disc)}>{totals.discrepancy}</Num>
        </div>

        {/* Below the total, not above it: quarantined records are excluded from
            every figure in that row, and position says so more plainly than a label. */}
        {quarantined && renderRow(quarantined)}
      </div>

      {/* Every figure here is a real number or N/A — no dash is reachable, so the key
          names only what this table can print. */}
      <TableFooter legend={<GlyphKey keys={['na']} />} />
    </section>
  );
}
