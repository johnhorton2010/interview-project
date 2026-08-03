// Windowing for the long report tables: which slice of a band is worth rendering, plus
// the spacers that stand in for the rest so the page still scrolls its true length.
//
// The *vertical* scroll container is the page, not an inner box. That is forced by the
// markup and stated in TransactionsTab: an overflow container would trap the sticky
// column header inside its own scroll box, and the header sticks to the page viewport
// under the app header (see APP_HEADER_H in styles/table.js). So the geometry here is
// read off `window.scrollY` and the band's own offset in the document.
//
// Breaks and Transactions do grow a horizontal scroll container at widths where their
// columns no longer fit (the `overflows` flag from styles/columns.js), and drop the
// sticky header for as long as it is there. Nothing below cares: rows keep their document
// positions and their heights, so `window.scrollY` and the band offset still describe the
// vertical geometry exactly as they do at full width.
//
// Spacers are plain divs with no `role`, rendered as siblings of the rows inside the
// `role="table"` container. Two consequences, both wanted: the container keeps its full
// virtual height, so the sticky header goes on working untouched; and `getAllByRole`
// never sees them, so a windowed table reads to assistive tech — and to the test
// helpers — as rows and nothing else.

import { useLayoutEffect, useMemo, useRef, useState } from 'react';

/**
 * Below this many rows, everything renders.
 *
 * Windowing is not free — prefix sums, a scroll listener, and rows that mount and unmount
 * as the page moves — and none of it buys anything a user could perceive on a table that
 * renders in a couple of milliseconds anyway. It also keeps the small tables, and every
 * existing test fixture, on the straightforward path.
 */
export const WINDOW_MIN = 120;

/** First-paint guesses, replaced by measurement before the user can see them. */
const EST = { row: 38, detail: 260 };

/** Largest `i` in [0, count-1] whose row starts at or above `y`. */
function indexAt(offsets, count, y) {
  if (y <= 0) return 0;
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Row heights, measured off whatever is currently rendered, keyed by row *shape*.
 *
 * Rows in these tables are not uniform: one carries a subline of ids beneath it and the
 * next does not, a merchant-ref cell may run to a second line, and at most one row at a
 * time is expanded. Rather than enumerate those variations here — which would put layout
 * knowledge in the wrong file and go stale the moment a cell changed — each row declares
 * its own shape with `data-row-shape`, and this measures one representative of each shape
 * it finds. A shape is whatever the caller says makes two rows differ in height.
 *
 * Measured rather than hard-coded because these heights follow the type scale and the row
 * padding; a constant would silently desync the scroll geometry from the layout the first
 * time either changed. Every measurement is retained once taken, including `detail` after
 * its row closes: the last real measurement beats the estimate.
 *
 * @param {{current: HTMLElement|null}} ref  the table wrapper
 * @param {string} sig  changes whenever the rendered rows might have changed shape
 * @returns {{ shapes: Record<string, number>, detail: number }}
 */
export function useRowMetrics(ref, sig) {
  const [metrics, setMetrics] = useState(() => ({ shapes: {}, detail: EST.detail }));
  const last = useRef(metrics);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const shapes = { ...last.current.shapes };
    let { detail } = last.current;
    let changed = false;
    let open = null;

    el.querySelectorAll('[data-row-shape]').forEach((row) => {
      const key = row.getAttribute('data-row-shape');
      const h = row.getBoundingClientRect().height;
      // jsdom performs no layout and reports every height as 0, so a measurement only
      // counts when it comes back positive.
      if (h <= 0) return;
      // An expanded row's height includes its detail panel, so it cannot stand in for its
      // shape — it is the one row that tells us what the panel costs instead.
      if (row.hasAttribute('data-row-open')) {
        open = open || { key, h };
        return;
      }
      // Sub-pixel noise must not provoke a render, or the effect that reads this result
      // becomes a loop.
      if (shapes[key] === undefined || Math.abs(shapes[key] - h) > 0.5) {
        shapes[key] = h;
        changed = true;
      }
    });

    if (open && shapes[open.key] > 0) {
      const d = open.h - shapes[open.key];
      if (d > 0 && Math.abs(d - detail) > 0.5) {
        detail = d;
        changed = true;
      }
    }

    if (changed) {
      last.current = { shapes, detail };
      setMetrics(last.current);
    }
  }, [ref, sig]);

  return metrics;
}

/** Height of a row of `shape`, falling back to the estimate until it has been measured. */
export function rowHeight(metrics, shape, open) {
  return (metrics.shapes[shape] || EST.row) + (open ? metrics.detail : 0);
}

/**
 * @param {object} o
 * @param {number}                o.count     rows in the band
 * @param {(i: number) => number} o.heightOf  height of row `i`, in px
 * @param {string}                o.sig       changes whenever `count` or any height would
 * @param {{current: HTMLElement|null}} o.ref  the band's leading spacer, for its page offset
 * @param {number} [o.overscan]   rows rendered beyond the viewport, each side
 * @returns {{ start: number, end: number, padTop: number, padBottom: number, windowed: boolean }}
 */
export function useWindowedRows({ count, heightOf, sig, ref, overscan = 8 }) {
  const windowed = count >= WINDOW_MIN;

  // Cumulative row tops: `offsets[i]` is the distance from the top of the band to the top
  // of row `i`, and `offsets[count]` is the band's full height. Exact per-row heights
  // rather than an average, because an average drifts, and drift over thousands of rows
  // puts the row under the pointer several rows from where the scrollbar says it is.
  //
  // `heightOf` is deliberately not a dependency — it is a fresh closure on every render,
  // and `sig` is the caller's summary of when its answers actually change.
  const offsets = useMemo(() => {
    if (!windowed) return null;
    const a = new Float64Array(count + 1);
    for (let i = 0; i < count; i += 1) {
      const h = heightOf(i);
      a[i + 1] = a[i] + (h > 0 ? h : 0);
    }
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowed, count, sig]);

  // The first render must already be windowed.
  //
  // Starting at the full count and letting the layout effect narrow it costs a mount of
  // every row — the exact thing windowing exists to avoid — and then throws it away one
  // render later. So open at a viewport's worth, estimated from the same row height the
  // effect will measure properly. The effect corrects this before paint, and at mount the
  // page is at the top of the band, so only `end` can be wrong, never `start`.
  const [range, setRange] = useState(() => ({
    start: 0,
    end: windowed ? Math.min(count, Math.ceil((globalThis.innerHeight || 900) / EST.row) + overscan + 1) : count,
  }));
  const current = useRef(range);

  useLayoutEffect(() => {
    const set = (start, end) => {
      if (current.current.start === start && current.current.end === end) return;
      current.current = { start, end };
      setRange(current.current);
    };

    if (!offsets) {
      set(0, count);
      return undefined;
    }

    let top = 0;
    let frame = 0;

    const measureTop = () => {
      const el = ref.current;
      top = el ? el.getBoundingClientRect().top + window.scrollY : 0;
    };
    const apply = () => {
      frame = 0;
      const y = window.scrollY - top;
      const first = indexAt(offsets, count, y);
      const lastVisible = indexAt(offsets, count, y + (window.innerHeight || 0));
      set(Math.max(0, first - overscan), Math.min(count, lastVisible + 1 + overscan));
    };
    // One recompute per frame however many scroll events arrive in it. The slice only
    // moves once the page has travelled past the overscan, so this settles into roughly
    // one re-render per few hundred pixels rather than one per event.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    // A resize moves the band as well as resizing the viewport; so does a filter changing
    // what sits above it, which is why `sig` re-runs this effect.
    const onResize = () => {
      measureTop();
      schedule();
    };

    measureTop();
    apply();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResize);
    };
  }, [offsets, count, overscan, ref]);

  // Clamped against a `count` that may have shrunk since the range was last set — the
  // render below this one would otherwise slice past the end of the array.
  const start = Math.min(range.start, count);
  const end = Math.min(range.end, count);

  return {
    start,
    end,
    padTop: offsets ? offsets[start] : 0,
    padBottom: offsets ? offsets[count] - offsets[end] : 0,
    windowed: !!offsets,
  };
}
