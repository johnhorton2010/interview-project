// Shared column sizing for the report tables.
//
// Each row of a table is its own CSS grid, so columns only line up because every
// row is handed an identical `grid-template-columns` string. That rules out
// content-based track sizes (`auto`, `max-content`) — they would resolve
// per-row, independently. It also rules out plain `fr`, which equalises final
// track *widths* rather than the slack left over inside them.
//
// Even gutters need even slack. Whitespace between two adjacent columns is
//
//     gap + trailingVoid(left column) + leadingVoid(right column)
//
// where a left-aligned column's void is trailing and a right-aligned column's is
// leading. Give every column the same slack `k` and every gutter collapses to
// `gap + k`, with one exception: a left→right boundary contributes both voids and
// comes out at `gap + 2k`, reading as the single deliberate divide between labels
// and figures.
//
// Two consequences drive the implementation:
//
//   * `track = content + k` means tracks must follow the *actual* rendered
//     content. Hard-coded worst-case minimums do not work — the slop between a
//     column's guess and its real content leaks straight into the gutter. So we
//     measure the rendered text and fit to it; `min` is only a safety floor.
//   * A right→left boundary contributes *neither* void and would pinch to bare
//     `gap`. Those columns get a left pad of exactly `k`, restoring `gap + k`.
//
// ---- What counts as "the content" ------------------------------------------
//
// A column is sized by the widest of two things:
//
//   * the **chrome** — the header row and any `data-col-labels` band line. Bounded
//     in number and carrying their own fonts, so they are measured straight off
//     the DOM.
//   * the **body**, which a caller may declare as one `candidates` string per
//     column instead of leaving it to be walked.
//
// The candidates path exists because a long table renders a *window* onto its data,
// not all of it. A width derived from whichever rows happen to be on screen would
// change as the table is scrolled — a candidate is a fact about the data, while the
// DOM is a fact about the scroll position. It is also what makes the cost O(columns)
// rather than O(rows × columns): walking the DOM means a `getComputedStyle` per cell,
// which is a forced style recalc, and at a few hundred rows that is thousands of them
// on every render.
//
// Callers that render every row they have (a table with one row per category, per
// merchant, per quarantined record) can omit `candidates` and keep the DOM walk.

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

export const TABLE_GAP = 16;

const MIN_SLACK = 8;
const MAX_SLACK = 64;

const clamp = (lo, v, hi) => Math.max(lo, Math.min(v, hi));

/**
 * Text that sizes a column — the mirror of the `data-col-labels` opt-in above.
 *
 * `data-col-ignore` marks decoration: a marker or badge that rides along inside a cell
 * but must not widen that column on every row for the sake of the few rows carrying it.
 * The trade is that such an element gets no width reserved for it, so it has to live in
 * the slack or spill into the gutter — its cell needs `overflow: visible` to do the
 * latter, since the gutter is the only space it can borrow.
 */
function sizingText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
  if (node.dataset && 'colIgnore' in node.dataset) return '';
  return [...node.childNodes].map(sizingText).join('');
}

function context2d() {
  const canvas = context2d.canvas || (context2d.canvas = document.createElement('canvas'));
  return canvas.getContext('2d');
}

/**
 * The font facts a column needs, read off one rendered cell.
 *
 * Canvas ignores letter-spacing, which the uppercase headers rely on, so it is applied
 * per character afterwards. `swatch` is the severity dot: a 7px square plus its 7px flex
 * gap, sitting outside the text run and so invisible to `measureText`.
 */
function readFont(cellEl) {
  const s = getComputedStyle(cellEl);
  const dot = cellEl.querySelector('span[aria-hidden="true"]');
  return {
    font: `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`,
    letterSpacing: parseFloat(s.letterSpacing) || 0,
    swatch: dot && getComputedStyle(dot).width === '7px' ? 14 : 0,
  };
}

function widthOf(ctx, f, text) {
  ctx.font = f.font;
  return ctx.measureText(text).width + f.letterSpacing * text.length + f.swatch;
}

/** Widest rendered content per column, measured off-layout with a canvas. */
function measureRows(rows, count, widths) {
  const ctx = context2d();
  rows.forEach((row) => {
    [...row.children].forEach((cellEl, i) => {
      if (i >= count) return;
      const text = sizingText(cellEl).trim();
      const w = widthOf(ctx, readFont(cellEl), text);
      if (w > widths[i]) widths[i] = w;
    });
  });
  return widths;
}

/**
 * The rows whose text is chrome rather than row data: the column header, and any band
 * line that opted in with `data-col-labels`. Both are bounded in number however long the
 * table gets, so both are measured off the DOM even on the candidates path.
 *
 * The header is identified by its first cell's role rather than by a `:has()` selector —
 * jsdom's selector engine does not support `:has()` reliably, and every table suite in
 * this project renders through it.
 */
function chromeRows(root) {
  const out = [];
  root.querySelectorAll('[role="row"]').forEach((row) => {
    const first = row.firstElementChild;
    if (first && first.getAttribute('role') === 'columnheader') out.push(row);
  });
  root.querySelectorAll('[data-col-labels]').forEach((el) => out.push(el));
  return out;
}

/** A rendered body row, wanted only for the fonts of its cells — never for its text. */
function bodyProbe(root) {
  const cell = root.querySelector('[role="row"] > [role="cell"]');
  return cell ? cell.parentElement : null;
}

/** Columns that need a left pad: left-aligned and preceded by a right-aligned one. */
function needsPad(spec) {
  return spec.map((c, i) => i > 0 && c.align !== 'right' && spec[i - 1].align === 'right');
}

/**
 * Resolve a column spec into a grid template plus per-column cell styling.
 *
 * @param {{current: HTMLElement|null}} ref  the `role="table"` wrapper
 * `fixed` opts a column out of the slack split. It exists for the trailing caret
 * affordance: a right-aligned caret needs slack when it follows a right-aligned
 * column (its own leading void supplies the gutter), but must go without when it
 * follows a left-aligned one, where the preceding column's trailing void already
 * supplies it. Getting this backwards pinches or doubles that one gutter.
 *
 * @param {Array<{key: string, min: number, fixed?: boolean, align?: 'left'|'right'}>} spec
 * @param {{ gap?: number, candidates?: Array<string|string[]>|null, fontKey?: string }} [opts]
 *
 * `candidates` is the caller's declaration of what each column's body has to fit, in
 * `spec` order. Supplying it replaces the per-cell DOM walk — see the file header. Omit
 * it and the body is measured off the rendered rows as before.
 *
 * An entry is normally the one widest string. It may instead be an array, for a column
 * whose widest string cannot be picked without measuring: proportional text has no
 * relation between character count and width, so a column of prose declares its whole
 * (bounded) vocabulary and lets the canvas decide. Monospace columns should stay single
 * strings — there, longest *is* widest, and one measurement beats many.
 *
 * `fontKey` invalidates the per-column font cache. Fonts are read once from a rendered
 * body row rather than per render, because on the candidates path the first rendered row
 * changes as the table scrolls, and re-reading would let a track jump mid-scroll. The
 * contract: anything that changes a column's font must change this string.
 *
 * `overflows` reports that the resolved template is wider than the container — the
 * tracks are at their floor and the grid is spilling out of it. A caller that has no
 * scroll container of its own (Breaks, Transactions, which keep a page-sticky header)
 * uses it to grow one only for as long as it is needed; see the note on `natural` below.
 *
 * @returns {{ template: string, gap: number, cell: (key: string) => object, cells: object[], isRight: (key: string) => boolean, overflows: boolean }}
 */
export function useColumns(ref, spec, { gap = TABLE_GAP, candidates = null, fontKey = '' } = {}) {
  const [resolved, setResolved] = useState(() => ({
    template: spec.map((c) => `${c.min}px`).join(' '),
    pads: {},
    overflows: false,
  }));
  const [tick, setTick] = useState(0);
  const last = useRef(resolved.template);
  const lastOverflows = useRef(resolved.overflows);
  const fonts = useRef({ key: null, list: null });

  // What the measurement below actually depends on. A *join* rather than the array's
  // identity, so a caller rebuilding an equal candidates list every render costs nothing
  // and need not memoize it. On the fallback path there is no such summary — the rendered
  // content can change without anything here changing — so a fresh object stands in and
  // the effect keeps running after every render, exactly as it always did.
  const sig = candidates ? candidates.join(' ') : {};

  // Measurement is canvas-based, so it does not depend on the template we are about to
  // set; state only updates when the result changes, so this settles in one extra pass
  // rather than looping.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const row = el.querySelector('[role="row"]');
    // `|| 0` per side, not on the sum: getComputedStyle reports '' for an unset padding
    // and parseFloat('') is NaN, which would poison the surplus, then the slack, then
    // every track — the whole template comes out as "NaNpx".
    const inset = row
      ? (() => {
          const s = getComputedStyle(row);
          return (parseFloat(s.paddingLeft) || 0) + (parseFloat(s.paddingRight) || 0);
        })()
      : 0;

    const content = new Array(spec.length).fill(0);
    if (candidates) {
      // Chrome first — it is also what supplies a font for any column whose body is
      // empty in this view.
      measureRows(chromeRows(el), spec.length, content);
      const key = `${fontKey}|${spec.length}`;
      if (fonts.current.key !== key || !fonts.current.list) {
        const probe = bodyProbe(el);
        if (probe) fonts.current = { key, list: [...probe.children].map(readFont) };
      }
      const list = fonts.current.list;
      if (list) {
        const ctx = context2d();
        candidates.forEach((entry, i) => {
          if (i >= spec.length || !entry || !list[i]) return;
          (Array.isArray(entry) ? entry : [entry]).forEach((text) => {
            if (!text) return;
            const w = widthOf(ctx, list[i], String(text));
            if (w > content[i]) content[i] = w;
          });
        });
      }
    } else {
      measureRows([...el.querySelectorAll('[role="row"], [data-col-labels]')], spec.length, content);
    }
    const base = spec.map((c, i) => Math.max(c.min, Math.ceil(content[i] || 0)));
    const pad = needsPad(spec);

    // Each padded column consumes k twice: once as slack, once as its left pad.
    // `fixed` columns take none — see the flag's note in the type below.
    const shares = spec.filter((c) => !c.fixed).length + pad.filter(Boolean).length;
    const gaps = gap * (spec.length - 1);
    const surplus = el.clientWidth - inset - base.reduce((n, w) => n + w, 0) - gaps;
    const k = Math.round(clamp(MIN_SLACK, surplus / shares, MAX_SLACK));

    // The narrowest this table can be drawn: every track at its content floor, with the
    // slack already bottomed out at MIN_SLACK. Below that the tracks cannot give any
    // further — the cells ellipsize but the sum of the tracks does not shrink — so the
    // grid overflows its container and the caller has to supply somewhere to scroll.
    // Guarded on a non-zero width because jsdom reports 0 for every box, and a table
    // that has not been laid out is not a table that is overflowing.
    const natural = inset + base.reduce((n, w) => n + w, 0) + gaps + shares * MIN_SLACK;
    const overflows = el.clientWidth > 0 && natural > el.clientWidth;

    const template = spec
      .map((c, i) => `${base[i] + (c.fixed ? 0 : k) + (pad[i] ? k : 0)}px`)
      .join(' ');
    const pads = {};
    spec.forEach((c, i) => {
      if (pad[i]) pads[c.key] = k;
    });

    // `overflows` is part of the guard, not merely of the payload: `k` is pinned at
    // MIN_SLACK on both sides of the width where it flips, so the template string is
    // identical there and guarding on it alone would swallow the transition.
    if (template !== last.current || overflows !== lastOverflows.current) {
      last.current = template;
      lastOverflows.current = overflows;
      setResolved({ template, pads, overflows });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, gap, spec, fontKey, sig, tick]);

  // Re-measure on container resize so gutters stay even as the window changes.
  // Either signal only needs to provoke a render; the effect above recomputes.
  // ResizeObserver catches container changes that are not window-driven (a
  // collapsing panel), but its delivery rides the rendering lifecycle and is
  // throttled in background tabs, so the resize event backs it up.
  useLayoutEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const el = ref.current;
    const ro = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(bump) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', bump);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', bump);
    };
  }, [ref]);

  const byKey = useMemo(() => {
    const m = {};
    spec.forEach((c) => (m[c.key] = c));
    return m;
  }, [spec]);

  /** Style fragment for a header or body cell — alignment and pad. */
  const cell = useCallback(
    (key) => {
      const c = byKey[key];
      if (!c) return {};
      const p = resolved.pads[key];
      return {
        textAlign: c.align === 'right' ? 'right' : 'left',
        ...(p ? { paddingLeft: p } : null),
      };
    },
    [byKey, resolved],
  );

  // The same fragments in `spec` order, as one array whose identity changes only when the
  // template does. A memoized row component can take this as a single prop; calling
  // `cell(key)` per cell would hand it a fresh object on every render and defeat the memo.
  const cells = useMemo(() => spec.map((c) => cell(c.key)), [spec, cell]);

  const isRight = useCallback((key) => byKey[key]?.align === 'right', [byKey]);

  return { template: resolved.template, gap, cell, cells, isRight, overflows: resolved.overflows };
}
