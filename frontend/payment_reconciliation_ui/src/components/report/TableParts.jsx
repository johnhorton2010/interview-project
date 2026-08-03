// The cells every report table builds rows out of. Each of these existed two or
// three times over, once per tab, byte-identical or near enough that the copies had
// already started to drift — `Head` and `HeadCell` were the same component under two
// names; `SortHeader` and `SortH` differed only in how they took alignment.

import React from 'react';
import { createPortal } from 'react-dom';
import { emptyState, footerBar } from '../../styles/table.js';
import { C, MONO, SANS, INK2 } from '../../styles/tokens.js';

const TIP_WIDTH = 260;
const VIEWPORT_PAD = 8;

/**
 * Hover/focus state and geometry for a column tooltip.
 *
 * The panel is portalled to <body> rather than nested in the header, for three reasons
 * that each rule out nesting on their own: `measureContent` sizes a column from its
 * header cell's `textContent` (styles/columns.js), so an open tooltip would blow the
 * column out to its own width; its text would join the header button's accessible name;
 * and every table wraps itself in `overflowX: 'auto'` — Summary, Merchants and Quarantine
 * always, Breaks and Transactions at widths where their columns stop fitting — which
 * would clip it at the card edge. A header is also a grid item, so the panel cannot be a
 * sibling either — that would claim a column.
 */
function useColumnTip(help) {
  const ref = React.useRef(null);
  const id = React.useId();
  const [box, setBox] = React.useState(null);

  const show = React.useCallback(() => {
    const el = ref.current;
    if (!el || !help) return;
    const r = el.getBoundingClientRect();
    // Clamp so the rightmost columns — Discrepancy on Summary, Quarantine on Merchants —
    // cannot push the panel off-screen.
    const left = Math.max(VIEWPORT_PAD, Math.min(r.left, window.innerWidth - TIP_WIDTH - VIEWPORT_PAD));
    // Open downward into the table so it never collides with the sticky app header,
    // flipping up only when there is no room below.
    const below = window.innerHeight - r.bottom;
    setBox(below < 130 ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 });
  }, [help]);

  const hide = React.useCallback(() => setBox(null), []);

  React.useEffect(() => {
    if (!box) return undefined;
    const onKey = (e) => e.key === 'Escape' && hide();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [box, hide]);

  const anchor = help
    ? {
        ref,
        'aria-describedby': box ? id : undefined,
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      }
    : { ref };

  const tip = box ? createPortal(<ColumnTip id={id} help={help} box={box} />, document.body) : null;
  return { anchor, tip };
}

/** The panel itself, styled like the SearchHelp popover. */
function ColumnTip({ id, help, box }) {
  const [first, ...rest] = help.split('\n');
  return (
    <div
      id={id}
      role="tooltip"
      style={{
        position: 'fixed',
        ...box,
        width: TIP_WIDTH,
        // Above the sticky table header (5), the category dropdowns (30) and the app
        // header (40); below the toast (90).
        zIndex: 50,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 7,
        boxShadow: '0 12px 28px rgba(19,26,36,0.13)',
        padding: '9px 11px',
        fontFamily: SANS,
        fontSize: 11,
        lineHeight: 1.45,
        textAlign: 'left',
        animation: 'riseIn 120ms ease-out',
        pointerEvents: 'none',
      }}
    >
      <div style={{ color: INK2 }}>{first}</div>
      {rest.map((line, i) => (
        <div key={i} style={{ marginTop: 3, color: C.dim }}>
          {line}
        </div>
      ))}
    </div>
  );
}

/**
 * Static column header. `right` is a convenience for tables whose spec has no
 * right→left boundary; the others pass `style={cell(key)}` and get the left-pad
 * correction from useColumns along with the alignment.
 *
 * `tabIndex` when it carries help: a tooltip reachable only by pointer is the failure
 * that ruled out the native `title` attribute, so these enter the tab order to earn it.
 */
export function HeadCell({ children, right, help, style }) {
  const { anchor, tip } = useColumnTip(help);
  return (
    <span
      role="columnheader"
      tabIndex={help ? 0 : undefined}
      {...anchor}
      style={{ textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap', ...style }}
    >
      {children}
      {tip}
    </span>
  );
}

/**
 * One label in a mid-table section band — a restatement of a column header, not a header
 * itself, so it carries no `columnheader` role and stays out of the tab order. The real
 * header above it is focusable and carries the same definition, so a keyboard user
 * already has every one of these; making the restatements focusable too would add a
 * couple of dozen tab stops to one table for nothing new.
 */
export function BandLabel({ children, help, style }) {
  const { anchor, tip } = useColumnTip(help);
  return (
    <span {...anchor} style={style}>
      {children}
      {tip}
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
export function SortHeader({ label, active, dir, onClick, style, help }) {
  const { anchor, tip } = useColumnTip(help);
  return (
    <button
      type="button"
      role="columnheader"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={onClick}
      {...anchor}
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
      {tip}
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
