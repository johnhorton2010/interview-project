import React, { useRef } from 'react';
import { fmt, dec, downloadCsv } from '../../domain/format.js';
import { C, MONO, SANS, INK, INK2 } from '../../styles/tokens.js';
import { useColumns } from '../../styles/columns.js';
import { GhostButton } from '../common.jsx';

// The backend does not return a reason string; derive a best-effort explanation
// from the record itself so the analyst knows why it was withheld.
function ledgerReason(l) {
  if (!l.cardType) return 'Missing card type — required field absent.';
  if (l.gross === null) return 'Gross amount not a parseable number.';
  if (l.currency && l.currency !== 'USD') return `Currency ${l.currency} — non-USD records are always quarantined.`;
  return 'Failed validation.';
}
function settleReason(s) {
  if (s.settled === null) return 'Settled amount omitted by the processor.';
  if (s.currency && s.currency !== 'USD') return `Currency ${s.currency} — non-USD records are always quarantined.`;
  return 'Failed validation.';
}

// `reason` follows a right-aligned column, so useColumns pads it automatically to
// keep that boundary from pinching to bare gap.
const SPEC = [
  { key: 'side', min: 56 },
  { key: 'id', min: 120 },
  { key: 'merchant', min: 72 },
  { key: 'amount', min: 64, align: 'right' },
  { key: 'reason', min: 200 },
];

export default function QuarantineTab({ model, flash }) {
  const tableRef = useRef(null);
  const { template: COLS, gap: GAP, cell } = useColumns(tableRef, SPEC);
  const rows = model.ledger
    .filter((l) => l.category === 'QUARANTINE')
    .map((l) => ({ side: 'Ledger', id: l.id, merchantId: l.merchantId, amount: l.gross === null ? '—' : fmt(l.gross), raw: l.gross, reason: ledgerReason(l) }))
    .concat(
      model.settle
        .filter((x) => x.category === 'QUARANTINE')
        .map((x) => ({ side: 'Settlement', id: x.ref, merchantId: x.merchantId, amount: x.settled === null ? '—' : fmt(x.settled), raw: x.settled, reason: settleReason(x) })),
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
    <section style={{ background: '#fff', border: '1px dashed #cfd6e0', borderRadius: 8, overflowX: 'auto' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.borderSoft}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Quarantined records</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7b8697' }}>
            Failed validation and excluded from every figure on this report. Fix at source and re-import — there is no reset endpoint in v1.
          </p>
        </div>
        <GhostButton onClick={exportCsv}>Export CSV</GhostButton>
      </div>

      <div ref={tableRef} role="table" aria-label="Quarantined records" style={{ fontSize: 13 }}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: GAP, padding: '9px 18px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7b8697' }}>
          <span role="columnheader">Side</span>
          <span role="columnheader">Identifier</span>
          <span role="columnheader">Merchant</span>
          <span role="columnheader" style={cell('amount')}>Amount</span>
          <span role="columnheader" style={cell('reason')}>Why it was withheld</span>
        </div>
        {rows.length === 0 && <div style={{ padding: '22px 18px', color: '#9aa3b0' }}>Nothing quarantined — every record passed validation.</div>}
        {rows.map((r, i) => (
          <div key={i} role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: GAP, padding: '10px 18px', borderBottom: `1px solid ${C.rowRule}`, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
            <span role="cell" style={{ fontFamily: SANS, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7b8697' }}>{r.side}</span>
            <span role="cell" style={{ color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.id}</span>
            <span role="cell" style={{ color: INK2 }}>{r.merchantId}</span>
            <span role="cell" style={{ ...cell('amount'), whiteSpace: 'nowrap', color: INK }}>{r.amount}</span>
            <span role="cell" style={{ ...cell('reason'), fontFamily: SANS, color: INK2, fontSize: 12, textWrap: 'pretty' }}>{r.reason}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
