import React from 'react';
import { C, MONO, INK, INK2, ACCENT } from '../../styles/tokens.js';
import { useDismiss } from '../common.jsx';

// Search-grammar reference, shared by the Breaks and Transactions toolbars. Ported
// from the design's `searchHelp` list (Reconciliation Console.dc.html lines 346–351).
export const SEARCH_HELP = [
  ['ORD-008  MERCH-006', 'plain text — ids, network refs, merchant, merchant ref, type, category'],
  ['831.42   $1,557.02', 'any money column — gross, settled, fees or discrepancy'],
  ['2026-06-05', 'either date column'],
  ['2026-06', 'the whole month'],
  ['2026-06-01..2026-06-05', 'a date range, inclusive'],
  ['captured:  settled:', 'pin a date to one column; settled: also accepts an amount'],
  ['gross: fees: disc:', 'pin an amount to one column; amount: searches all four'],
  ['type:refund  category:', 'match sale or refund, or a category name'],
];

/**
 * The `?` search-help control: a small button plus a dismiss-on-outside-click
 * popover. `align` places the popover under the button ('right' for Breaks,
 * 'left' for Transactions), matching the design.
 */
export default function SearchHelp({ open, onToggle, onClose, align = 'right' }) {
  const ref = useDismiss(open, onClose);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        title="Search help"
        aria-expanded={open}
        onClick={onToggle}
        style={{ width: 26, height: 26, border: `1px solid ${open ? '#bcd0f5' : C.border}`, background: open ? '#eaf0fd' : '#fff', color: open ? ACCENT : INK2, borderRadius: 5, fontSize: 12, cursor: 'pointer', lineHeight: 1 }}
      >
        ?
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, zIndex: 30, width: 372, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 7, boxShadow: '0 12px 28px rgba(19,26,36,0.13)', padding: '12px 14px', animation: 'riseIn 120ms ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>Search</span>
            <button type="button" onClick={onClose} style={{ border: 0, background: 'none', padding: 0, fontSize: 11, color: INK2, cursor: 'pointer' }}>Close</button>
          </div>
          <p style={{ margin: '0 0 9px', fontSize: 12, color: INK2 }}>Terms are combined with AND. Plain words match ids, merchant, refs, type and category.</p>
          {SEARCH_HELP.map(([syntax, note], i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '148px 1fr', gap: 10, padding: '3px 0', borderTop: `1px solid ${C.rowRule}` }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: INK }}>{syntax}</span>
              <span style={{ fontSize: 11, color: '#7b8697' }}>{note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
