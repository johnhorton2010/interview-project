import React, { useState } from 'react';
import { buildDetail } from '../domain/detail.js';
import { C, MONO, SANS, INK, INK2, ACCENT } from '../styles/tokens.js';
import { Btn } from './common.jsx';
import { FieldList, Panel } from './DetailPanels.jsx';

// Blue "related transaction" panel palette (design: #bcd0f5 / #f2f6fe / #eef2fb).
const REL = { border: '#bcd0f5', bg: '#f2f6fe', headerBg: '#eef2fb', headerFg: '#2f5fd0', headerRule: '#dbe5fa', fieldRule: '#e0e9fb' };

function RelatedPanel({ label, id, children }) {
  return (
    <div style={{ border: `1px solid ${REL.border}`, borderRadius: 7, background: REL.bg, animation: 'riseIn 140ms ease-out', minWidth: 0 }}>
      <div
        style={{
          padding: '9px 12px',
          borderBottom: `1px solid ${REL.headerRule}`,
          background: REL.headerBg,
          borderRadius: '6px 6px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: REL.headerFg,
        }}
      >
        <span>{label}</span>
        <span style={{ fontFamily: MONO, textTransform: 'none', letterSpacing: 0 }}>{id}</span>
      </div>
      {children}
    </div>
  );
}

/** Centred "nothing on this side" message — the body of a panel, or a card of its own. */
function EmptyBody({ title, sub }) {
  return (
    <div style={{ padding: '22px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: INK }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: '#7b8697', marginTop: 4, textWrap: 'pretty' }}>{sub}</div>}
    </div>
  );
}

function MathBox({ math }) {
  return (
    <div>
      {math.map((m, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            padding: '4px 0',
            borderTop: `1px solid ${m.rule}`,
          }}
        >
          <span style={{ fontSize: 12, color: m.labelColor, fontWeight: m.weight }}>{m.label}</span>
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

/** Two-sided break detail. Pass a row + model; it builds and renders the detail. */
export default function BreakDetail({ row, model }) {
  const d = buildDetail(row, model);
  const [openIds, setOpenIds] = useState([]);
  const toggle = (id) => setOpenIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const openRelated = d.related.filter((rel) => openIds.includes(rel.id));

  return (
    <div
      style={{
        background: '#fbfcfd',
        borderTop: `1px solid ${C.borderSoft}`,
        padding: '18px 16px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 296px minmax(0, 1fr)',
        gap: 16,
        alignItems: 'start',
        animation: 'riseIn 140ms ease-out',
        fontFamily: SANS,
      }}
    >
      {/* Left column — ledger side + related ledger panels */}
      <div style={{ display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
        <Panel title="Ledger side">
          {d.hasLedger ? (
            <FieldList fields={d.ledgerFields} />
          ) : (
            <EmptyBody title="No ledger transaction" sub="The processor settled something absent from our ledger." />
          )}
        </Panel>
        {openRelated.map((rel) => (
          <RelatedPanel key={rel.id} label={rel.label} id={rel.id}>
            {rel.ledgerFields.length ? (
              <FieldList fields={rel.ledgerFields} rule={REL.fieldRule} />
            ) : (
              <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: 12, color: INK2 }}>No ledger transaction</div>
            )}
          </RelatedPanel>
        ))}
      </div>

      {/* Center column — reason + arithmetic + related list */}
      <div style={{ border: `1px solid ${d.reasonBorder}`, background: d.reasonBg, borderRadius: 7, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: d.sevColor }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{d.label}</span>
        </div>
        <p style={{ margin: '8px 0 12px', fontSize: 12, color: INK2, textWrap: 'pretty' }}>{d.explain}</p>
        <div style={{ borderTop: `1px solid ${d.reasonBorder}`, paddingTop: 8 }}>
          <MathBox math={d.math} />
        </div>

        {d.related.length > 0 && (
          <div style={{ marginTop: 10, borderTop: `1px solid ${d.reasonBorder}`, paddingTop: 8, display: 'grid', gap: 6 }}>
            {d.related.map((rel) => {
              const open = openIds.includes(rel.id);
              return (
                <div key={rel.id} style={{ border: `1px solid ${C.border}`, background: '#fff', borderRadius: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', alignItems: 'center', padding: '7px 9px' }}>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7b8697' }}>{rel.label}</span>
                    <Btn
                      aria-expanded={open}
                      onClick={() => toggle(rel.id)}
                      style={{ border: `1px solid ${C.border}`, background: open ? '#eaf0fd' : '#ffffff', color: open ? ACCENT : INK2, fontSize: 11, padding: '3px 8px', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      hoverStyle={{ borderColor: ACCENT }}
                    >
                      {open ? 'Hide panels' : 'Show panels'}
                    </Btn>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: INK }}>{rel.id}</span>
                    <span style={{ fontFamily: MONO, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: INK, textAlign: 'right' }}>{rel.amount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {d.relatedNote && (
          <p style={{ margin: '10px 0 0', paddingTop: 8, borderTop: `1px solid ${d.reasonBorder}`, fontSize: 11, color: '#7b8697', textWrap: 'pretty' }}>{d.relatedNote}</p>
        )}
      </div>

      {/* Right column — settlement side + related settlement panels */}
      <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
        {d.settlementCards.length ? (
          d.settlementCards.map((c, i) => (
            <Panel key={i} title="Processor side" badge={c.badge}>
              <FieldList fields={c.fields} />
            </Panel>
          ))
        ) : (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff' }}>
            <EmptyBody title="No settlement received" sub="We recorded a sale the processor never settled." />
          </div>
        )}
        {openRelated.map((rel) =>
          rel.settlementCards.length ? (
            rel.settlementCards.map((c, i) => (
              <RelatedPanel key={rel.id + i} label={rel.label} id={c.badge}>
                <FieldList fields={c.fields} rule={REL.fieldRule} />
              </RelatedPanel>
            ))
          ) : (
            <RelatedPanel key={rel.id} label={rel.label} id={rel.id}>
              <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: 12, color: INK2 }}>No settlement received</div>
            </RelatedPanel>
          ),
        )}
      </div>
    </div>
  );
}
