// Column sizing, exercised through a throwaway table rather than by calling the hook
// directly — the measurement runs off rendered DOM, so there is nothing to test without
// one. This file also pins the canvas stub in src/test/setup.js: if that stub regresses,
// every table suite fails here first, with a comprehensible message.
import { describe, it, expect } from 'vitest';
import { useRef } from 'react';
import { render } from '@testing-library/react';
import { useColumns, TABLE_GAP } from './columns.js';

const SPEC = [
  { key: 'merchant', min: 40 },
  { key: 'amount', min: 40, align: 'right' },
  // Left-aligned and preceded by a right-aligned column: this is the one that gets the
  // left pad restoring an even gutter.
  { key: 'category', min: 40 },
  { key: 'caret', min: 8, fixed: true, align: 'right' },
];

const tracks = (template) => template.split(' ').map((t) => parseFloat(t));

function Table({ spec = SPEC, merchant = 'M-1', badge = null, onResolve }) {
  const ref = useRef(null);
  const { template, cell, isRight } = useColumns(ref, spec);
  onResolve?.({ template, cell, isRight });
  return (
    <div ref={ref} role="table" aria-label="Probe">
      <div role="row" style={{ display: 'grid', gridTemplateColumns: template, gap: TABLE_GAP, padding: '0 14px' }}>
        <span role="cell" style={cell('merchant')}>
          {merchant}
          {badge && <span data-col-ignore>{badge}</span>}
        </span>
        <span role="cell" style={cell('amount')}>$1,186.63</span>
        <span role="cell" style={cell('category')}>Duplicate settlement</span>
        <span role="cell" style={cell('caret')}>▾</span>
      </div>
    </div>
  );
}

/** Last resolved value after the layout effect has settled. */
function resolve(props = {}) {
  const seen = [];
  render(<Table {...props} onResolve={(r) => seen.push(r)} />);
  return { last: seen.at(-1), seen };
}

describe('useColumns', () => {
  it('resolves a pixel track per column', () => {
    const { last } = resolve();
    const t = tracks(last.template);
    expect(last.template).toMatch(/^\d+px \d+px \d+px \d+px$/);
    expect(t).toHaveLength(SPEC.length);
  });

  it('produces no NaN track when the row reports no padding', () => {
    // getComputedStyle returns '' for an unset padding, and parseFloat('') is NaN — which
    // would poison `inset`, then the slack, then every track. Guarding it here keeps the
    // five table suites from silently asserting against "NaNpx" templates.
    const { last } = resolve();
    expect(last.template).not.toMatch(/NaN/);
  });

  it('fits a track to its content rather than to its floor', () => {
    const narrow = tracks(resolve({ merchant: 'M-1' }).last.template)[0];
    const wide = tracks(resolve({ merchant: 'MERCHANT-000000000004' }).last.template)[0];
    expect(wide).toBeGreaterThan(narrow);
    // Every track clears the spec floor plus the shared slack.
    expect(narrow).toBeGreaterThanOrEqual(40);
  });

  it('ignores data-col-ignore decoration when sizing', () => {
    const plain = tracks(resolve({ merchant: 'M-1' }).last.template)[0];
    const badged = tracks(resolve({ merchant: 'M-1', badge: '  ← spillover badge' }).last.template)[0];
    expect(badged).toBe(plain);
  });

  it('aligns right-aligned columns and left-pads only the one following them', () => {
    const { last } = resolve();
    expect(last.cell('amount')).toMatchObject({ textAlign: 'right' });
    expect(last.cell('merchant')).toMatchObject({ textAlign: 'left' });
    // `category` is left-aligned directly after right-aligned `amount`.
    expect(last.cell('category').paddingLeft).toBeGreaterThan(0);
    // `merchant` opens the row, so it has no preceding column to pinch against.
    expect(last.cell('merchant').paddingLeft).toBeUndefined();
    expect(last.isRight('amount')).toBe(true);
    expect(last.isRight('category')).toBe(false);
  });

  it('gives a fixed column no slack while its neighbours take theirs', () => {
    const { last } = resolve();
    const t = tracks(last.template);
    const k = last.cell('category').paddingLeft; // the shared slack, surfaced as the pad
    expect(t[3]).toBe(8); // caret: its `min`, with no slack added
    expect(t[0]).toBeGreaterThanOrEqual(40 + k);
  });

  it('settles in one extra pass rather than looping', () => {
    // The effect runs after every render and only calls setState when the template
    // changes. So a mount costs exactly two passes — the `min` floors, then the measured
    // template — and a re-render with unchanged content costs none.
    const seen = [];
    const { rerender } = render(<Table onResolve={(r) => seen.push(r)} />);

    expect(seen).toHaveLength(2);
    expect(seen[0].template).toBe('40px 40px 40px 8px'); // the spec floors, pre-measurement
    expect(seen[1].template).not.toBe(seen[0].template);

    rerender(<Table onResolve={(r) => seen.push(r)} />);
    expect(seen).toHaveLength(3);
    expect(seen[2].template).toBe(seen[1].template);
  });
});
