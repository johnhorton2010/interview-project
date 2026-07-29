import React, { useState } from 'react';
import { buildDetail } from '../domain/detail.js';
import { C, MONO, SANS, INK, INK2, ACCENT } from '../styles/tokens.js';

function FieldList({ fields }) {
  return (
    <div style={{ display: 'grid', gap: 1 }}>
      {fields.map((f, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '110px 1fr',
            gap: 10,
            padding: '5px 8px',
            borderRadius: 5,
            background: f.bg,
            boxShadow: f.ring,
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: 11, color: '#7b8697' }}>{f.label}</span>
          <span
            style={{
              fontSize: 12.5,
              color: INK,
              fontFamily: f.mono ? MONO : SANS,
              textAlign: 'right',
              wordBreak: 'break-all',
            }}
          >
            {f.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${C.borderSoft}`,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: '#7b8697',
          background: C.surfaceAlt,
        }}
      >
        {title}
      </div>
      <div style={{ padding: 8 }}>{children}</div>
    </div>
  );
}

function EmptyPanel({ text }) {
  return (
    <div
      style={{
        border: `1px dashed ${C.border}`,
        borderRadius: 8,
        padding: '22px 14px',
        textAlign: 'center',
        color: '#9aa3b0',
        fontSize: 12.5,
        background: C.surfaceAlt,
      }}
    >
      {text}
    </div>
  );
}

function MathBox({ math }) {
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      {math.map((m, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            padding: m.top ? '7px 0 3px' : '3px 0',
            borderTop: m.top ? `1px solid ${C.border}` : 'none',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: m.size, color: m.labelColor, fontWeight: m.weight }}>{m.label}</span>
          <span
            style={{
              fontSize: m.size,
              fontFamily: MONO,
              fontVariantNumeric: 'tabular-nums',
              color: m.color,
              fontWeight: m.weight,
            }}
          >
            {m.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function DetailBody({ d, depth = 0 }) {
  const [openIds, setOpenIds] = useState([]);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {/* Ledger side */}
        {d.hasLedger ? (
          <Panel title="Ledger side">
            <FieldList fields={d.ledgerFields} />
          </Panel>
        ) : (
          <EmptyPanel text="No ledger transaction — settled with no record on our side." />
        )}

        {/* Reason + arithmetic */}
        <div
          style={{
            border: `1px solid ${d.reasonBorder}`,
            background: d.reasonBg,
            borderRadius: 8,
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: d.sevColor }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{d.label}</span>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: INK2, textWrap: 'pretty' }}>{d.explain}</p>
          <MathBox math={d.math} />
        </div>

        {/* Processor side */}
        {d.settlementCards.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {d.settlementCards.map((c, i) => (
              <Panel key={i} title={`Processor side · ${c.badge}`}>
                <FieldList fields={c.fields} />
              </Panel>
            ))}
          </div>
        ) : (
          <EmptyPanel text="No settlement received — we expected a payout that never arrived." />
        )}
      </div>

      {/* Related transactions (one level) */}
      {(d.related.length > 0 || d.relatedNote) && depth === 0 && (
        <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: 12 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7b8697', marginBottom: 8 }}>
            Related
          </div>
          {d.relatedNote && <p style={{ margin: 0, fontSize: 12, color: INK2 }}>{d.relatedNote}</p>}
          {d.related.map((rel) => {
            const open = openIds.includes(rel.id);
            return (
              <div key={rel.id} style={{ border: `1px solid ${C.border}`, borderRadius: 7, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: rel.sevColor }} />
                  <span style={{ fontSize: 12, color: INK2 }}>{rel.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: INK }}>{rel.id}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: INK2, marginLeft: 'auto' }}>{rel.amount}</span>
                  {rel.detail && (
                    <button
                      type="button"
                      onClick={() => setOpenIds(open ? openIds.filter((i) => i !== rel.id) : [...openIds, rel.id])}
                      style={{ border: 0, background: 'none', color: ACCENT, fontSize: 12, cursor: 'pointer', padding: 0 }}
                    >
                      {open ? 'Hide panels' : 'Show panels'}
                    </button>
                  )}
                </div>
                {open && rel.detail && (
                  <div style={{ padding: '0 12px 12px' }}>
                    <DetailBody d={rel.detail} depth={1} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Two-sided break detail. Pass a row + model; it builds and renders the detail. */
export default function BreakDetail({ row, model }) {
  const d = buildDetail(row, model);
  return (
    <div style={{ padding: '4px 16px 16px', fontFamily: SANS }}>
      <DetailBody d={d} />
    </div>
  );
}
