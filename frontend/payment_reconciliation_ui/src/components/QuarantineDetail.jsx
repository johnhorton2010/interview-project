import React from 'react';
import { buildQuarantineDetail } from '../domain/quarantine.js';
import { C, SANS, INK, INK2 } from '../styles/tokens.js';
import { FieldList, Panel } from './DetailPanels.jsx';

/**
 * Expanded detail for one quarantined record: the record's own fields beside the
 * reason it was withheld, with the offending field carrying the same amber highlight
 * the break detail uses for a field that disagrees across sides.
 *
 * One-sided by design. A quarantined ledger transaction and the settlement linked to
 * it are two rows in this table, each with its own detail — so there is no counterpart
 * panel, and no arithmetic: the record contributes to nothing on the report.
 */
export default function QuarantineDetail({ rec, side }) {
  const d = buildQuarantineDetail(rec, side);

  return (
    <div
      style={{
        background: '#fbfcfd',
        borderTop: `1px solid ${C.borderSoft}`,
        padding: '18px 16px',
        display: 'grid',
        // 296px matches the break detail's reason column, so the two details read as one
        // family; the cap keeps a single panel from stretching the width of the table.
        gridTemplateColumns: 'minmax(0, 1fr) 296px',
        gap: 16,
        maxWidth: 860,
        // The record panel always runs taller — 8 field rows on the ledger side, 9 on the
        // settlement side — so stretching lets the reason box meet its bottom edge and the
        // pair reads square. Contents stay top-aligned inside the box either way.
        alignItems: 'stretch',
        animation: 'riseIn 140ms ease-out',
        fontFamily: SANS,
      }}
    >
      <Panel title="Quarantined record" badge={d.side}>
        <FieldList fields={d.fields} />
      </Panel>

      <div style={{ border: `1px solid ${d.reasonBorder}`, background: d.reasonBg, borderRadius: 7, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: d.sevColor }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{d.label}</span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: INK, textWrap: 'pretty' }}>{d.reason}</p>
        {/* Elaborates the line above it, so it carries no rule of its own — the rule
            below separates both from the category's generic copy. */}
        {d.note && <p style={{ margin: '6px 0 0', fontSize: 12, color: INK2, textWrap: 'pretty' }}>{d.note}</p>}
        <p style={{ margin: '10px 0 0', paddingTop: 8, borderTop: `1px solid ${d.reasonBorder}`, fontSize: 12, color: INK2, textWrap: 'pretty' }}>
          {d.explain}
        </p>
      </div>
    </div>
  );
}
