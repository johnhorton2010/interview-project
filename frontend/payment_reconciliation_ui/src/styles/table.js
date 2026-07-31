// One definition of every value the report's five tables used to repeat as inline
// literals. `columns.js` already owned how wide a column is; this owns what a row
// looks like and what ink a figure takes.
//
// The style helpers return fragments, not components: each table still writes its
// own JSX, because the shapes genuinely differ (subtotals, section bands, two-line
// cells, an expandable detail). What they must not differ on is the padding, the
// rules, the type scale and the colour of a number — that lives here.

import { C, MONO, SANS, INK, INK2, NEG, POS } from './tokens.js';

/**
 * Horizontal inset for every row of every table.
 *
 * 18px, matching the chrome each table sits in — the Summary and Merchant card
 * headers, the Breaks and Transactions toolbars, and FilterStrip are all 18px. The
 * two toolbar tables used to inset their rows by 16px, which left their columns a
 * shade narrower than the toolbar directly above them.
 */
export const TABLE_INSET = 18;

const pad = (v) => `${v}px ${TABLE_INSET}px`;

/** Sticky offset for a table header: the app header's height (see App.jsx). */
const APP_HEADER_H = 56;

/** Column-header row. `sticky` pins it under the app header while the body scrolls. */
export const headerRow = (template, gap, sticky) => ({
  display: 'grid',
  gridTemplateColumns: template,
  gap,
  padding: pad(9),
  borderBottom: `1px solid ${C.border}`,
  background: C.surfaceAlt,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: C.muted,
  ...(sticky ? { position: 'sticky', top: APP_HEADER_H, zIndex: 5 } : null),
});

/**
 * Body row. Mono and tabular-nums sit on the row, not the cell, so figures align
 * down the column by default and a prose cell opts back into SANS explicitly.
 */
export const bodyRow = (template, gap) => ({
  display: 'grid',
  gridTemplateColumns: template,
  gap,
  padding: pad(10),
  cursor: 'pointer',
  fontFamily: MONO,
  fontVariantNumeric: 'tabular-nums',
});

/** Rule beneath a body row. Separate from `bodyRow`: Breaks and Transactions put it
 *  on the HoverRow wrapper so the row, its subline and its detail tint as one. */
export const rowRule = { borderBottom: `1px solid ${C.rowRule}` };

/**
 * Summary row. `strong` marks a grand total — the firm rule a lone Total row always
 * had; subtotals sit under a softer one so the two read as a hierarchy.
 */
export const totalRow = (template, gap, strong = true) => ({
  display: 'grid',
  gridTemplateColumns: template,
  gap,
  padding: pad(11),
  borderTop: `1px solid ${strong ? C.borderStrong : C.borderSoft}`,
  background: C.surfaceAlt,
  fontFamily: MONO,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 500,
});

/** Label cell in a summary row — prose, so it leaves the row's mono. */
export const totalLabel = { fontFamily: SANS, fontSize: 12, whiteSpace: 'nowrap' };

/** Footer bar under a table: counts, sort state, caveats. */
export const footerBar = {
  padding: pad(11),
  borderTop: `1px solid ${C.borderSoft}`,
  background: C.surfaceAlt,
  fontSize: 11,
  color: C.dim,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
};

/** "Nothing matched" placeholder, sitting where a row would. */
export const emptyState = { padding: pad(26), color: C.dim, fontSize: 13 };

// ---- value → ink -----------------------------------------------------------
//
// One rule, stated four ways: **colour means sign, weight means presence.**
//
//   * Red or green appears only where a figure is actually signed — a deduction that
//     deducted something, a discrepancy that went one way or the other. Colour is not
//     used for salience, so a balanced row is not greyed for being uninteresting.
//   * The light `ABSENT` ink appears only where there is no figure at all. A dash is
//     not data; it must never outweigh a cell that has a real value in it.
//   * Everything else — including every zero — reads at full strength. `$0.00` is a
//     measured fact, and it reads the same under Refunds as it does under Sales.
//
// Every helper shares the absent case, so that rule holds by construction rather than
// by being remembered at each of the ~20 call sites.

const ABSENT = C.dim;
const isAbsent = (c) => c === null || c === undefined;

/** Plain money — sales, expected pay, settled. */
export const figureColor = (c) => (isAbsent(c) ? ABSENT : INK);

/** Refunds and fees. Red once something was actually subtracted; a zero subtracted nothing. */
export const deductionColor = (c) => (isAbsent(c) ? ABSENT : c === 0 ? INK : NEG);

/** Discrepancy: red when the processor settled more, green when it settled less. */
export const discColor = (c) => (isAbsent(c) ? ABSENT : c === 0 ? INK : c < 0 ? NEG : POS);

/**
 * Secondary text — merchant, refs, dates. Unlike the money columns these carry their
 * absence as a string (a literal '—' or an empty ref), not as null, so the test differs
 * even though the outcome is the same ink.
 */
export const labelColor = (v) => (isAbsent(v) || v === '' || v === '—' ? ABSENT : INK2);
