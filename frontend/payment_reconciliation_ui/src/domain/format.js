// Display and CSV helpers, ported verbatim from the design component so formatting
// (currency, signs, short refs) matches the prototype exactly. Amounts are cents.
//
// Strings only — what ink a figure takes is a styling question, answered by
// the colour helpers in styles/table.js.

/** "$1,234.56" / "−$65.64" (leading minus, not parentheses — PRD §10.2). */
export function fmt(c) {
  if (c === null || c === undefined) return '—';
  const abs = Math.abs(c);
  const s = (abs / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (c < 0 ? '−$' : '$') + s;
}

/** Signed variant used for discrepancy/impact: "+$3.50", "−$65.64", "$0.00". */
export function sfmt(c) {
  if (c === null || c === undefined) return '—';
  if (c === 0) return '$0.00';
  return (c > 0 ? '+' : '') + fmt(c);
}

/**
 * Deduction display — refunds and fees, which the report subtracts.
 *
 * One helper for both storage conventions: the Summary and Merchant rollups carry
 * these as positive magnitudes, Breaks and Transactions carry refund gross already
 * negative. `Math.abs` collapses the two, so every tab prints the same string.
 *
 * '—' means the value does not exist; a genuine zero prints '$0.00'. Those are
 * distinct — a refund settles at $0.00, which is not the same as never settling.
 */
export function neg(c) {
  if (c === null || c === undefined) return '—';
  return c === 0 ? fmt(0) : fmt(-Math.abs(c));
}

/** Plain decimal string for CSV cells; '' for null. */
export function dec(c) {
  return c === null || c === undefined ? '' : (c / 100).toFixed(2);
}

/**
 * Plain decimal for a deduction — always negative, as the screen prints it. The CSV
 * counterpart to `neg()`, and `Math.abs` collapses the same two storage conventions:
 * the Summary and Merchant rollups hold these as positive magnitudes, Breaks and
 * Transactions hold refund gross already negative.
 *
 * Every Refunds, Interchange, Processor and Fees cell in every export goes through this.
 * They used to be negated inline, which is how two files ended up disagreeing on the
 * sign of the same column.
 */
export function decNeg(c) {
  return c === null || c === undefined ? '' : dec(-Math.abs(c));
}

export function shortRefOf(ref) {
  return 'ARN…' + String(ref).slice(-5);
}

// ---- search-grammar helpers ------------------------------------------------

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const RANGE_RE = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

/** Strip $ , whitespace and normalise a unicode minus to ASCII. */
export function normAmt(t) {
  return String(t)
    .replace(/[$,\s]/g, '')
    .replace(/[−–—]/g, '-');
}

/** Candidate string forms of a cent amount, so "1557", "1557.02", "-1557.02" all hit. */
export function amtStrings(c) {
  if (c === null || c === undefined) return [];
  const abs = (Math.abs(c) / 100).toFixed(2);
  const signed = (c < 0 ? '-' : '') + abs;
  return [abs, signed, abs.replace(/\.00$/, ''), signed.replace(/\.00$/, '')];
}

export function dateMatches(value, term) {
  if (!value || value === '—') return false;
  const rng = RANGE_RE.exec(term);
  if (rng) {
    const lo = rng[1] < rng[2] ? rng[1] : rng[2];
    const hi = rng[1] < rng[2] ? rng[2] : rng[1];
    return value >= lo && value <= hi;
  }
  if (DATE_RE.test(term)) return value === term;
  return String(value).indexOf(term) === 0; // partial prefix, e.g. "2026-06"
}

export function isDateish(term) {
  return DATE_RE.test(term) || RANGE_RE.test(term) || /^\d{4}(-\d{2})?(-\d{2})?$/.test(term);
}

// ---- CSV export ------------------------------------------------------------

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * Build CSV text (header row first) and trigger a client-side download.
 * Amounts should be passed as plain decimals so spreadsheets parse them.
 * @returns {number} rows written (excluding header)
 */
export function downloadCsv(filename, header, rows) {
  const body = [header]
    .concat(rows)
    .map((r) => r.map(csvCell).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
  return rows.length;
}
