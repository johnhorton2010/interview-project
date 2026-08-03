// Windowing geometry. jsdom performs no layout, so heights come from the harness rather
// than from the DOM — which is the point: the hook takes heights as data precisely so
// that its arithmetic can be checked without a layout engine.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useRef } from 'react';
import { render, act } from '@testing-library/react';
import { useWindowedRows, WINDOW_MIN } from './useWindowedRows.js';

const ROW = 40;
const VIEWPORT = 800;
const OVERSCAN = 8;

/** Band top at y=0 in the document, so scrollY maps straight onto row offsets. */
function stubLayout() {
  Element.prototype.getBoundingClientRect = function rect() {
    return { top: -window.scrollY, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
  };
}

function Band({ count, heightOf = () => ROW, onRender }) {
  const ref = useRef(null);
  const w = useWindowedRows({ count, heightOf, sig: `${count}`, ref, overscan: OVERSCAN });
  onRender(w);
  return (
    <div>
      <div ref={ref} style={{ height: w.padTop }} />
      {Array.from({ length: w.end - w.start }, (_, i) => (
        <div key={w.start + i} role="row" />
      ))}
      <div style={{ height: w.padBottom }} />
    </div>
  );
}

function mount(props) {
  const seen = [];
  const view = render(<Band {...props} onRender={(w) => seen.push(w)} />);
  return { ...view, at: () => seen.at(-1) };
}

/** Scroll the page and let the hook's rAF-coalesced handler run. */
async function scrollTo(y) {
  window.scrollY = y;
  await act(async () => {
    window.dispatchEvent(new Event('scroll'));
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('useWindowedRows', () => {
  const realRect = Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    stubLayout();
    window.scrollY = 0;
    window.innerHeight = VIEWPORT;
    // jsdom has no rAF timing; run the callback on the macrotask queue so the coalescing
    // path is the one under test rather than being stubbed out synchronously.
    vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(() => cb(0), 0));
    vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = realRect;
    vi.unstubAllGlobals();
  });

  it('renders every row below the threshold, with no spacers', () => {
    const { at } = mount({ count: WINDOW_MIN - 1 });
    expect(at()).toMatchObject({ start: 0, end: WINDOW_MIN - 1, padTop: 0, padBottom: 0, windowed: false });
  });

  it('windows at and above the threshold', () => {
    const { at } = mount({ count: WINDOW_MIN });
    expect(at().windowed).toBe(true);
    expect(at().end).toBeLessThan(WINDOW_MIN);
  });

  it('accounts for every row it does not render', () => {
    const count = 1000;
    const { at } = mount({ count });
    const w = at();
    expect(w.padTop + (w.end - w.start) * ROW + w.padBottom).toBe(count * ROW);
  });

  it('advances the window by the number of rows scrolled past', async () => {
    const { at } = mount({ count: 1000 });
    expect(at().start).toBe(0);

    await scrollTo(100 * ROW);
    expect(at().start).toBe(100 - OVERSCAN);
    expect(at().padTop).toBe((100 - OVERSCAN) * ROW);
    // The window covers the viewport plus overscan on both sides. `end` is exclusive and
    // the row starting exactly on the viewport's bottom edge is still rendered, so the
    // last index is 120 and `end` is one past it plus the overscan.
    expect(at().end).toBe(100 + VIEWPORT / ROW + 1 + OVERSCAN);
  });

  it('places boundaries exactly when rows differ in height', async () => {
    // Every third row is twice as tall — the shape a subline, or a single expanded row,
    // gives the real table. An averaged height would drift; prefix sums do not.
    const heightOf = (i) => (i % 3 === 0 ? 2 * ROW : ROW);
    const top = (n) => Array.from({ length: n }, (_, i) => heightOf(i)).reduce((a, b) => a + b, 0);

    const { at } = mount({ count: 1000, heightOf });
    await scrollTo(top(90));

    expect(at().start).toBe(90 - OVERSCAN);
    expect(at().padTop).toBe(top(90 - OVERSCAN));
  });

  it('keeps the rendered slice a window, not the whole band', async () => {
    const { at, container } = mount({ count: 5000 });
    await scrollTo(2000 * ROW);
    expect(container.querySelectorAll('[role="row"]').length).toBe(at().end - at().start);
    expect(at().end - at().start).toBeLessThan(60);
  });
});
