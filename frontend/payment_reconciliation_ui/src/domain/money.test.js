import { describe, it, expect } from 'vitest';
import { toCents, sumCents, formatCents } from './money.js';

describe('toCents', () => {
  it('parses plain decimal strings to integer cents', () => {
    expect(toCents('738.25')).toBe(73825);
    expect(toCents('351.60')).toBe(35160);
    expect(toCents('351.6')).toBe(35160);
    expect(toCents('120')).toBe(12000);
    expect(toCents('0.00')).toBe(0);
  });

  it('handles negatives', () => {
    expect(toCents('-336.42')).toBe(-33642);
    expect(toCents('-837.39')).toBe(-83739);
  });

  it('accepts numbers as well as strings', () => {
    expect(toCents(606.29)).toBe(60629);
    expect(toCents(0)).toBe(0);
  });

  it('does not accumulate float error (the 709.51 case)', () => {
    expect(toCents('709.51')).toBe(70951);
    expect(toCents(709.51)).toBe(70951);
  });

  it('rounds half-up beyond two decimals', () => {
    expect(toCents('1.005')).toBe(101);
    expect(toCents('1.004')).toBe(100);
  });

  it('returns null for missing or non-numeric input', () => {
    expect(toCents(null)).toBeNull();
    expect(toCents(undefined)).toBeNull();
    expect(toCents('')).toBeNull();
    expect(toCents('N/A')).toBeNull();
  });
});

describe('sumCents', () => {
  it('sums, treating null as zero', () => {
    expect(sumCents([100, 200, null, 50])).toBe(350);
    expect(sumCents([])).toBe(0);
  });
});

describe('formatCents', () => {
  it('formats with a leading minus and em dash for null', () => {
    expect(formatCents(509536)).toBe('$5,095.36');
    expect(formatCents(-6564)).toBe('-$65.64');
    expect(formatCents(null)).toBe('—');
  });
});
