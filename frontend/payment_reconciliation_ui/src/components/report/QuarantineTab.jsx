import React, { useRef, useMemo, useCallback } from 'react';
import { LEDGER, SETTLEMENT, quarantineReason } from '../../domain/quarantine.js';
import { fmt, dec, downloadCsv } from '../../domain/format.js';
import { C, SANS, INK, INK2 } from '../../styles/tokens.js';
import { useColumns } from '../../styles/columns.js';
import { useWindowedRows, useRowMetrics, rowHeight } from '../../hooks/useWindowedRows.js';
import { bodyRow, headerRow, rowRule, figureColor } from '../../styles/table.js';
import { GhostButton, HoverRow } from '../common.jsx';
import { HeadCell, EmptyState, TableFooter, GlyphKey } from './TableParts.jsx';
import { QUARANTINE_HELP as HELP } from './columnHelp.js';
import QuarantineDetail from '../QuarantineDetail.jsx';

// `reason` follows a right-aligned column, so useColumns pads it automatically to
// keep that boundary from pinching to bare gap.
const SPEC = [
  { key: 'side', min: 56 },
  { key: 'id', min: 120 },
  { key: 'merchant', min: 72 },
  { key: 'amount', min: 64, align: 'right' },
  { key: 'reason', min: 200 },
  // `reason` is left-aligned, so its own trailing void already supplies this gutter —
  // the caret must not claim slack of its own on top of it (see styles/columns.js).
  { key: 'caret', min: 8, fixed: true, align: 'right' },
];

/**
 * One withheld record.
 *
 * Memoized because this table windows its rows and re-slices as the page scrolls.
 *
 * The row's height depends on how many lines the reason wraps to, so the reason itself is
 * the shape key — the vocabulary in domain/quarantine.js is small and fixed, so the set of
 * shapes stays bounded however many records are withheld.
 */
const QuarantineRow = React.memo(function QuarantineRow({ r, rowIndex, open, template, gap, cell, onToggle }) {
  const toggle = useCallback(() => onToggle(r.key), [onToggle, r.key]);
  return (
    // Hover lives on the wrapper so the cells and the expanded detail tint
    // together as one row, matching the Breaks and Transactions tables.
    <HoverRow data-row-shape={r.reason} data-row-open={open || undefined} style={rowRule} hoverStyle={{ background: C.hover }}>
      <div
        role="row"
        aria-rowindex={rowIndex}
        aria-expanded={open}
        onClick={toggle}
        style={{ ...bodyRow(template, gap), background: open ? C.hover : 'transparent' }}
      >
        <span role="cell" style={{ fontFamily: SANS, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>{r.side}</span>
        <span role="cell" style={{ color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.id}</span>
        <span role="cell" style={{ color: INK2 }}>{r.merchantId}</span>
        <span role="cell" style={{ ...cell('amount'), whiteSpace: 'nowrap', color: figureColor(r.raw) }}>{r.amount}</span>
        <span role="cell" style={{ ...cell('reason'), fontFamily: SANS, color: INK2, fontSize: 12, textWrap: 'pretty' }}>{r.reason}</span>
        <span role="cell" aria-hidden="true" style={{ ...cell('caret'), color: C.dim, alignSelf: 'center' }}>{open ? '▴' : '▾'}</span>
      </div>
      {open && <QuarantineDetail rec={r.rec} side={r.side} />}
    </HoverRow>
  );
});

export default function QuarantineTab({ model, expanded, setExpanded, flash }) {
  const tableRef = useRef(null);
  // Expansion keys are prefixed by side: `expanded` is shared with Breaks and
  // Transactions, and a bare ledger id or network ref could collide with a ReconRow id
  // owned by one of them.
  const rows = useMemo(
    () =>
      model.ledger
        .filter((l) => l.category === 'QUARANTINE')
        .map((l) => ({ key: `q:ledger:${l.id}`, rec: l, side: LEDGER, id: l.id, merchantId: l.merchantId, amount: l.gross === null ? '—' : fmt(l.gross), raw: l.gross, reason: quarantineReason(l, LEDGER).text }))
        .concat(
          model.settle
            .filter((x) => x.category === 'QUARANTINE')
            .map((x) => ({ key: `q:settle:${x.ref}`, rec: x, side: SETTLEMENT, id: x.ref, merchantId: x.merchantId, amount: x.settled === null ? '—' : fmt(x.settled), raw: x.settled, reason: quarantineReason(x, SETTLEMENT).text })),
        ),
    [model],
  );

  // ---- column sizing
  //
  // Declared rather than walked off the DOM: a windowed table renders only the rows on
  // screen, so measuring the DOM would make track widths follow the scroll position. See
  // the header of styles/columns.js.
  //
  // `reason` is the one column that cannot name a single widest string — it is
  // proportional prose, where character count says nothing about width — so it declares
  // its distinct values and lets the canvas pick. That set is bounded by the reason
  // vocabulary, not by the number of records.
  const candidates = useMemo(() => {
    const text = ['', '', '', '', '', '▾'];
    const reasons = new Set();
    let bare = -1;
    let signed = -1;
    const put = (i, s2) => {
      if (s2 && s2.length > text[i].length) text[i] = s2;
    };
    rows.forEach((r) => {
      put(0, r.side);
      put(1, r.id);
      put(2, r.merchantId);
      if (r.raw === null || r.raw === undefined) put(3, '—');
      else if (r.raw < 0) signed = Math.max(signed, -r.raw);
      else bare = Math.max(bare, r.raw);
      reasons.add(r.reason);
    });
    const a = bare < 0 ? '' : fmt(bare);
    const b = signed < 0 ? '' : '−' + fmt(signed);
    const amount = b.length > a.length ? b : a;
    return [text[0], text[1], text[2], amount.length >= text[3].length ? amount : text[3], [...reasons], text[5]];
  }, [rows]);

  const { template: COLS, gap: GAP, cell } = useColumns(tableRef, SPEC, { candidates });

  // ---- windowing
  const H = useRowMetrics(tableRef, `${expanded}|${COLS}`);
  const bandRef = useRef(null);
  const onToggle = useCallback((k) => setExpanded((p) => (p === k ? null : k)), [setExpanded]);
  const window_ = useWindowedRows({
    count: rows.length,
    heightOf: useCallback(
      (i) => rowHeight(H, rows[i].reason, rows[i].key === expanded),
      [rows, expanded, H],
    ),
    sig: `${rows.length}|${expanded}|${JSON.stringify(H)}`,
    ref: bandRef,
  });
  const visible = rows.slice(window_.start, window_.end);

  const exportCsv = () => {
    const n = downloadCsv(
      'quarantined-records.csv',
      ['Side', 'Identifier', 'Merchant', 'Amount', 'Reason'],
      rows.map((r) => [r.side, r.id, r.merchantId, dec(r.raw), r.reason]),
    );
    flash(`quarantined-records.csv — ${n} rows exported`);
  };

  return (
    <section style={{ background: C.surface, border: '1px dashed #cfd6e0', borderRadius: 8, overflowX: 'auto' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.borderSoft}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Quarantined records</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
            Quarantined records are excluded from every calculation on this report. Click a row to see the full transaction detail.
          </p>
        </div>
        <GhostButton onClick={exportCsv}>Export CSV</GhostButton>
      </div>

      {/* `aria-rowcount` is the whole table, not the rendered slice: a windowed band has only
          its visible rows in the DOM, and without this a screen reader would be told the
          table is fifty rows long. Header row included, hence the +1. */}
      <div ref={tableRef} role="table" aria-label="Quarantined Records" aria-rowcount={rows.length + 1} style={{ fontSize: 13 }}>
        <div role="row" aria-rowindex={1} style={headerRow(COLS, GAP)}>
          <HeadCell style={cell('side')} help={HELP.side}>Side</HeadCell>
          <HeadCell style={cell('id')} help={HELP.id}>Identifier</HeadCell>
          <HeadCell style={cell('merchant')} help={HELP.merchant}>Merchant</HeadCell>
          <HeadCell style={cell('amount')} help={HELP.amount}>Amount</HeadCell>
          <HeadCell style={cell('reason')} help={HELP.reason}>Why it was withheld</HeadCell>
          <span role="columnheader" />
        </div>
        {rows.length === 0 && <EmptyState>Nothing quarantined.</EmptyState>}
        {/* Stands in for the rows above the window, and marks the band's top for the
            scroll geometry. Rendered even at zero height so the ref always has an element
            and the DOM shape does not change with the row count. */}
        <div ref={bandRef} aria-hidden="true" style={{ height: window_.padTop }} />
        {visible.map((r, i) => (
          <QuarantineRow
            key={r.key}
            r={r}
            rowIndex={window_.start + i + 2}
            open={expanded === r.key}
            template={COLS}
            gap={GAP}
            cell={cell}
            onToggle={onToggle}
          />
        ))}
        {window_.padBottom > 0 && <div aria-hidden="true" style={{ height: window_.padBottom }} />}
      </div>

      {/* The clearest place in the report to state the pair: a record withheld for a
          zero-value amount reads $0.00, one withheld for an omitted amount reads —. */}
      <TableFooter legend={<GlyphKey keys={['dash', 'zero']} />} />
    </section>
  );
}
