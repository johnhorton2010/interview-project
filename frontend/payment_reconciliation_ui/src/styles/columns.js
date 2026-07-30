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

import { useLayoutEffect, useRef, useState } from 'react';

export const TABLE_GAP = 16;

const MIN_SLACK = 8;
const MAX_SLACK = 64;

const clamp = (lo, v, hi) => Math.max(lo, Math.min(v, hi));

/** Widest rendered content per column, measured off-layout with a canvas. */
function measureContent(root, count) {
  const canvas = measureContent.canvas || (measureContent.canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  const widths = new Array(count).fill(0);
  root.querySelectorAll('[role="row"], [data-col-labels]').forEach((row) => {
    [...row.children].forEach((cellEl, i) => {
      if (i >= count) return;
      const s = getComputedStyle(cellEl);
      ctx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const text = cellEl.textContent.trim();
      let w = ctx.measureText(text).width;
      // Canvas ignores letter-spacing, which the uppercase headers rely on.
      const ls = parseFloat(s.letterSpacing);
      if (ls) w += ls * text.length;
      // Severity swatch: 7px square plus its 7px flex gap, outside the text run.
      const dot = cellEl.querySelector('span[aria-hidden="true"]');
      if (dot && getComputedStyle(dot).width === '7px') w += 14;
      if (w > widths[i]) widths[i] = w;
    });
  });
  return widths;
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
 * @param {number} [gap]
 * @returns {{ template: string, gap: number, cell: (key: string) => object, isRight: (key: string) => boolean }}
 */
export function useColumns(ref, spec, gap = TABLE_GAP) {
  const [resolved, setResolved] = useState(() => ({
    template: spec.map((c) => `${c.min}px`).join(' '),
    pads: {},
  }));
  const [, setTick] = useState(0);
  const last = useRef(resolved.template);

  // Runs after every render. Measurement is canvas-based, so it does not depend
  // on the template we are about to set; state only updates when the result
  // changes, so this settles in one extra pass rather than looping.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const row = el.querySelector('[role="row"]');
    const inset = row
      ? (() => {
          const s = getComputedStyle(row);
          return parseFloat(s.paddingLeft) + parseFloat(s.paddingRight);
        })()
      : 0;

    const content = measureContent(el, spec.length);
    const base = spec.map((c, i) => Math.max(c.min, Math.ceil(content[i] || 0)));
    const pad = needsPad(spec);

    // Each padded column consumes k twice: once as slack, once as its left pad.
    // `fixed` columns take none — see the flag's note in the type below.
    const shares = spec.filter((c) => !c.fixed).length + pad.filter(Boolean).length;
    const gaps = gap * (spec.length - 1);
    const surplus = el.clientWidth - inset - base.reduce((n, w) => n + w, 0) - gaps;
    const k = Math.round(clamp(MIN_SLACK, surplus / shares, MAX_SLACK));

    const template = spec
      .map((c, i) => `${base[i] + (c.fixed ? 0 : k) + (pad[i] ? k : 0)}px`)
      .join(' ');
    const pads = {};
    spec.forEach((c, i) => {
      if (pad[i]) pads[c.key] = k;
    });

    if (template !== last.current) {
      last.current = template;
      setResolved({ template, pads });
    }
  });

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

  const byKey = {};
  spec.forEach((c) => (byKey[c.key] = c));

  return {
    template: resolved.template,
    gap,
    /** Style fragment for a header or body cell — alignment and pad. */
    cell: (key) => {
      const c = byKey[key];
      if (!c) return {};
      const p = resolved.pads[key];
      return {
        textAlign: c.align === 'right' ? 'right' : 'left',
        ...(p ? { paddingLeft: p } : null),
      };
    },
    isRight: (key) => byKey[key]?.align === 'right',
  };
}
