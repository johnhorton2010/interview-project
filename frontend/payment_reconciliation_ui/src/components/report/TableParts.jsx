// The cells every report table builds rows out of. Each of these existed two or
// three times over, once per tab, byte-identical or near enough that the copies had
// already started to drift — `Head` and `HeadCell` were the same component under two
// names; `SortHeader` and `SortH` differed only in how they took alignment.

import React from 'react';
import { emptyState, footerBar } from '../../styles/table.js';
import { C, MONO, INK2 } from '../../styles/tokens.js';

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

/**
 * The report's symbol vocabulary — every glyph that stands in for a figure, in one
 * place so the wording cannot drift between the tables that print them.
 *
 * `zero` is not a symbol on its own; it earns a place only beside `dash`, which exists
 * to say "this is not a zero". On a reconciliation report "charged nothing" and "no
 * data" carry very different consequences, so the pair is stated rather than implied.
 */
export const GLYPH = {
  dash: ['—', 'no value exists'],
  zero: ['$0.00', 'a value that is genuinely zero'],
  na: ['N/A', 'excluded from this figure'],
  ditto: ['〃', 'repeats the row above, counted once'],
};

/**
 * Key of the symbols a table can print, one per line. A table names only what it can
 * produce, so no footer advertises a symbol its rows never render.
 *
 * Stacked rather than run inline: inline, each glyph starts wherever the previous
 * entry's text happened to end, so the glyphs never line up. A two-column grid aligns
 * them and their meanings, which is most of what makes a key scannable.
 */
export function GlyphKey({ keys }) {
  return (
    // Boxed like the related-record blocks in BreakDetail — the same thing in a different
    // place: a small captioned reference block sitting inside a larger surface.
    // `fit-content` keeps it hugging its entries rather than spanning the footer, which
    // would read as a second band rather than a key.
    <div style={{ width: 'fit-content', border: `1px solid ${C.border}`, background: C.surface, borderRadius: 6, padding: '7px 9px' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: 4 }}>
        Legend
      </div>
      {/* A description list is what this is — a term, then what the term means. Grid on
          the <dl> makes the dt/dd pairs its grid items, so column one sizes to the widest
          glyph and every meaning starts on the same x. Both UA margins are zeroed: <dl>
          ships with `1em 0`, and <dd> with a 40px inline start that would indent every
          meaning clear of its own column. */}
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 10, rowGap: 2 }}>
        {keys.map((k) => (
          <React.Fragment key={k}>
            <dt style={{ fontFamily: MONO, color: INK2 }}>{GLYPH[k][0]}</dt>
            <dd style={{ margin: 0, color: C.dim }}>{GLYPH[k][1]}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

/**
 * Footer bar: a notes row (one note left, one right-aligned against it) above the
 * symbol key. Every part is optional — Summary and Quarantine carry only a key.
 */
export function TableFooter({ left, right, legend, style }) {
  const notes = left || right;
  return (
    <div style={{ ...footerBar, ...style }}>
      {notes && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
      {legend && <div style={{ marginTop: notes ? 7 : 0 }}>{legend}</div>}
    </div>
  );
}
