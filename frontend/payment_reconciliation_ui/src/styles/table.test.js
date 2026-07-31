import { describe, it, expect } from 'vitest';
import { figureColor, deductionColor, discColor, labelColor } from './table.js';
import { C, INK, INK2, NEG, POS } from './tokens.js';
import { neg, fmt, sfmt } from '../domain/format.js';

// These four helpers are the report's entire visual grammar: every money cell on every
// tab derives its ink from one of them. The invariant they exist to hold is
//
//     colour means sign, weight means presence
//
// so the tests below are written against that sentence rather than against the palette —
// a change that reintroduces per-column or per-magnitude dimming should fail here.

const ABSENT = C.dim;

describe('figureColor — plain money (sales, expected pay, settled)', () => {
  it('gives every real figure the same ink, zero included', () => {
    expect(figureColor(73825)).toBe(INK);
    expect(figureColor(0)).toBe(INK);
    expect(figureColor(-33642)).toBe(INK);
  });

  it('reserves the lighter ink for an absent value', () => {
    expect(figureColor(null)).toBe(ABSENT);
    expect(figureColor(undefined)).toBe(ABSENT);
  });
});

describe('deductionColor — refunds and fees', () => {
  it('is red only when something was actually subtracted', () => {
    expect(deductionColor(1606)).toBe(NEG);
    expect(deductionColor(-1606)).toBe(NEG);
  });

  it('leaves a zero at full weight — nothing was subtracted, but the figure is real', () => {
    expect(deductionColor(0)).toBe(INK);
  });

  it('matches figureColor on a zero, so $0.00 reads alike across columns', () => {
    expect(deductionColor(0)).toBe(figureColor(0));
  });

  it('reserves the lighter ink for an absent value', () => {
    expect(deductionColor(null)).toBe(ABSENT);
    expect(deductionColor(undefined)).toBe(ABSENT);
  });
});

describe('discColor — discrepancy', () => {
  it('encodes direction: red settled more, green settled less', () => {
    expect(discColor(-6564)).toBe(NEG);
    expect(discColor(350)).toBe(POS);
  });

  it('leaves a balanced row at full weight rather than greying it for being dull', () => {
    expect(discColor(0)).toBe(INK);
    expect(discColor(0)).toBe(figureColor(0));
  });

  it('reserves the lighter ink for an absent value', () => {
    expect(discColor(null)).toBe(ABSENT);
  });
});

describe('labelColor — merchant, refs, dates', () => {
  it('renders a present value in secondary ink', () => {
    expect(labelColor('ORD-004-22337')).toBe(INK2);
    expect(labelColor('2026-06-10')).toBe(INK2);
  });

  // These columns carry absence as a string, not as null — `normalize.js` writes the
  // literal '—' into `row.date`, and a missing merchant ref arrives as ''.
  it('treats a dash, an empty string and null alike', () => {
    expect(labelColor('—')).toBe(ABSENT);
    expect(labelColor('')).toBe(ABSENT);
    expect(labelColor(null)).toBe(ABSENT);
    expect(labelColor(undefined)).toBe(ABSENT);
  });
});

describe('the ink rule holds against what the formatters actually print', () => {
  // Ties the two halves together: whatever a formatter renders as a dash must get the
  // absent ink from its matching helper, and whatever it renders as a figure must not.
  const cases = [
    ['sales', fmt, figureColor],
    ['refunds/fees', neg, deductionColor],
    ['discrepancy', sfmt, discColor],
  ];

  it.each(cases)('%s: a dash is the only thing that gets the absent ink', (_label, render, ink) => {
    expect(render(null)).toBe('—');
    expect(ink(null)).toBe(ABSENT);

    for (const cents of [0, 350, -6564]) {
      expect(render(cents)).not.toBe('—');
      expect(ink(cents)).not.toBe(ABSENT);
    }
  });
});
