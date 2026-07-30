// Panel primitives shared by the expanded detail views. A break detail stacks several
// of these across three columns; a quarantine detail shows one. Both render a record
// as the same bordered card with the same label/value lines, so an analyst moving
// between the two tabs is reading one format.

import React from 'react';
import { C, MONO, SANS, INK } from '../styles/tokens.js';

export function FieldList({ fields, rule }) {
  return (
    <div style={{ padding: '4px 12px 10px' }}>
      {fields.map((f, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            padding: '5px 0',
            borderBottom: `1px solid ${rule || '#f6f8fa'}`,
            fontSize: 12,
          }}
        >
          <span style={{ color: '#7b8697' }}>{f.label}</span>
          <span
            style={{
              fontFamily: f.mono ? MONO : SANS,
              color: INK,
              textAlign: 'right',
              background: f.bg,
              boxShadow: f.ring,
              borderRadius: 3,
              padding: '0 3px',
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

export function Panel({ title, badge, children }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff', minWidth: 0 }}>
      <div
        style={{
          padding: '9px 12px',
          borderBottom: `1px solid ${C.borderSoft}`,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: '#7b8697',
        }}
      >
        <span>{title}</span>
        {badge && <span style={{ fontFamily: MONO, textTransform: 'none', letterSpacing: 0 }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}
