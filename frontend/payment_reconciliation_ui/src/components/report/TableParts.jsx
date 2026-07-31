// The cells every report table builds rows out of. Each of these existed two or
// three times over, once per tab, byte-identical or near enough that the copies had
// already started to drift — `Head` and `HeadCell` were the same component under two
// names; `SortHeader` and `SortH` differed only in how they took alignment.

import React from 'react';
import { emptyState, footerBar } from '../../styles/table.js';

/**
 * Static column header. `right` is a convenience for tables whose spec has no
 * right→left boundary; the others pass `style={cell(key)}` and get the left-pad
 * correction from useColumns along with the alignment.
 */
export function HeadCell({ children, right, title, style }) {
  return (
    <span
      role="columnheader"
      title={title}
      style={{ textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap', ...style }}
    >
      {children}
    </span>
  );
}

/** Figure cell: right-aligned, never wrapped, ink supplied by the caller. */
export function Num({ children, color, style }) {
  return (
    <span role="cell" style={{ whiteSpace: 'nowrap', textAlign: 'right', color, ...style }}>
      {children}
    </span>
  );
}

/**
 * Sortable column header. Inherits the header row's type and colour rather than
 * restating them, so a button is indistinguishable from a static header until you
 * sort by it. `style` carries alignment — `cell(key)` from useColumns.
 */
export function SortHeader({ label, active, dir, onClick, style, title }) {
  return (
    <button
      type="button"
      role="columnheader"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={onClick}
      title={title}
      style={{
        border: 0,
        background: 'none',
        padding: 0,
        font: 'inherit',
        color: 'inherit',
        textTransform: 'inherit',
        letterSpacing: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        ...style,
      }}
    >
      {label}
      {active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

/** "Nothing matched" placeholder, sitting where a row would. */
export function EmptyState({ children }) {
  return <div style={emptyState}>{children}</div>;
}

/** Footer bar: a note on the left, a second one right-aligned against it. */
export function TableFooter({ left, right, style }) {
  return (
    <div style={{ ...footerBar, ...style }}>
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}
