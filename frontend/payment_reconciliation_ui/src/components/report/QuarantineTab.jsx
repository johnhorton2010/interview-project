import React, { useRef } from 'react';
import { LEDGER, SETTLEMENT, quarantineReason } from '../../domain/quarantine.js';
import { fmt, dec, downloadCsv } from '../../domain/format.js';
import { C, SANS, INK, INK2 } from '../../styles/tokens.js';
import { useColumns } from '../../styles/columns.js';
import { bodyRow, headerRow, rowRule, figureColor } from '../../styles/table.js';
import { GhostButton, HoverRow } from '../common.jsx';
import { EmptyState } from './TableParts.jsx';
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

export default function QuarantineTab({ model, expanded, setExpanded, flash }) {
  const tableRef = useRef(null);
  const { template: COLS, gap: GAP, cell } = useColumns(tableRef, SPEC);
  // Expansion keys are prefixed by side: `expanded` is shared with Breaks and
  // Transactions, and a bare ledger id or network ref could collide with a ReconRow id
  // owned by one of them.
  const rows = model.ledger
    .filter((l) => l.category === 'QUARANTINE')
    .map((l) => ({ key: `q:ledger:${l.id}`, rec: l, side: LEDGER, id: l.id, merchantId: l.merchantId, amount: l.gross === null ? '—' : fmt(l.gross), raw: l.gross, reason: quarantineReason(l, LEDGER).text }))
    .concat(
      model.settle
        .filter((x) => x.category === 'QUARANTINE')
        .map((x) => ({ key: `q:settle:${x.ref}`, rec: x, side: SETTLEMENT, id: x.ref, merchantId: x.merchantId, amount: x.settled === null ? '—' : fmt(x.settled), raw: x.settled, reason: quarantineReason(x, SETTLEMENT).text })),
    );

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
            Failed validation and excluded from every figure on this report. Click a row to see the record and the field that failed. Fix at source, then reset and re-import.
          </p>
        </div>
        <GhostButton onClick={exportCsv}>Export CSV</GhostButton>
      </div>

      <div ref={tableRef} role="table" aria-label="Quarantined records" style={{ fontSize: 13 }}>
        <div role="row" style={headerRow(COLS, GAP)}>
          <span role="columnheader">Side</span>
          <span role="columnheader">Identifier</span>
          <span role="columnheader">Merchant</span>
          <span role="columnheader" style={cell('amount')}>Amount</span>
          <span role="columnheader" style={cell('reason')}>Why it was withheld</span>
          <span role="columnheader" />
        </div>
        {rows.length === 0 && <EmptyState>Nothing quarantined — every record passed validation.</EmptyState>}
        {rows.map((r) => {
          const open = expanded === r.key;
          // Hover lives on the wrapper so the cells and the expanded detail tint
          // together as one row, matching the Breaks and Transactions tables.
          return (
            <HoverRow key={r.key} style={rowRule} hoverStyle={{ background: C.hover }}>
              <div
                role="row"
                aria-expanded={open}
                onClick={() => setExpanded(open ? null : r.key)}
                style={{ ...bodyRow(COLS, GAP), background: open ? C.hover : 'transparent' }}
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
        })}
      </div>
    </section>
  );
}
