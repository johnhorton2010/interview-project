// Integer-cent money arithmetic (PRD §7.1). JavaScript Number arithmetic on
// currency is prohibited: we parse to integer cents via string manipulation
// (never parseFloat * 100, which yields 70950.9999… for "709.51") and format
// once, at render.

/**
 * Parse a monetary value to signed integer cents.
 * Accepts number | string | null | undefined. Returns null for missing or
 * non-numeric input (e.g. "N/A") so callers can render "—".
 * @param {number|string|null|undefined} value
 * @returns {number|null}
 */
export function toCents(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === '') return null;

  const m = /^([+-]?)(\d*)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;
  if (m[2] === '' && (m[3] === undefined || m[3] === '')) return null;

  const sign = m[1] === '-' ? -1n : 1n;
  const intPart = m[2] === '' ? '0' : m[2];
  const frac = m[3] || '';

  let magnitude;
  if (frac.length <= 2) {
    const padded = (frac + '00').slice(0, 2);
    magnitude = BigInt(intPart) * 100n + BigInt(padded);
  } else {
    // Keep two decimals, round half-up on the third digit.
    magnitude = BigInt(intPart) * 100n + BigInt(frac.slice(0, 2));
    if (frac.charCodeAt(2) - 48 >= 5) magnitude += 1n;
  }
  return Number(sign * magnitude);
}

/** Sum a list of cent values, treating null as 0. */
export function sumCents(values) {
  let total = 0;
  for (const v of values) total += v == null ? 0 : v;
  return total;
}

export function addCents(a, b) {
  return (a == null ? 0 : a) + (b == null ? 0 : b);
}

export function subCents(a, b) {
  return (a == null ? 0 : a) - (b == null ? 0 : b);
}

export function absCents(a) {
  return a == null ? 0 : Math.abs(a);
}

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/**
 * Format integer cents for display. Null renders as an em dash. Negative values
 * use a leading minus (not parentheses), per PRD §10.2.
 * @param {number|null|undefined} cents
 * @param {{ dashForNull?: boolean }} [opts]
 */
export function formatCents(cents, { dashForNull = true } = {}) {
  if (cents === null || cents === undefined) return dashForNull ? '—' : '';
  return USD.format(cents / 100);
}
