import { describe, it, expect } from 'vitest';
import { COL, DEDUCTIONS, EXPORT_COLUMNS, project } from './exportColumns.js';
import { dec, decNeg } from '../../domain/format.js';

// These pin the two things the audit found broken across the five exports: a field
// carrying different names in different files, and a money column carrying different
// signs. Both were invisible on screen — you only saw them by opening two files.

const FILES = Object.entries(EXPORT_COLUMNS);
const NAMES = new Set(Object.values(COL));

describe('one name per field', () => {
  it.each(FILES)('%s draws every header from COL', (_name, cols) => {
    for (const c of cols) expect(NAMES.has(c), `"${c}" is not a canonical name`).toBe(true);
  });

  it('no file repeats a column', () => {
    for (const [name, cols] of FILES) expect(new Set(cols).size, name).toBe(cols.length);
  });

  // The ledger txn id used to be "Internal txn id", "Txn id" and "Ledger txn" in three
  // different files, and the network ref was singular in two and plural in a third.
  it('has retired the alternate spellings', () => {
    const all = FILES.flatMap(([, cols]) => cols);
    for (const dead of ['Internal txn id', 'Ledger txn', 'Network refs']) {
      expect(all, `"${dead}" is back`).not.toContain(dead);
    }
  });

  it('uses one spelling for the id and ref wherever they appear', () => {
    for (const [name, cols] of FILES) {
      const ids = cols.filter((c) => c === COL.txnId);
      const refs = cols.filter((c) => c === COL.networkRef);
      expect(ids.length, `${name} ids`).toBeLessThanOrEqual(1);
      expect(refs.length, `${name} refs`).toBeLessThanOrEqual(1);
    }
    // All three record-level files carry both, under those names.
    for (const f of ['breaks', 'transactionsLedger', 'transactionsSettlement']) {
      expect(EXPORT_COLUMNS[f], f).toContain(COL.txnId);
      expect(EXPORT_COLUMNS[f], f).toContain(COL.networkRef);
    }
  });
});

describe('money block order', () => {
  // Each total reads after its own inputs, so the columns spell out the arithmetic.
  const order = [COL.sales, COL.refunds, COL.interchange, COL.processor, COL.fees, COL.expected, COL.settled, COL.discrepancy];

  it.each(FILES)('%s keeps the money columns in arithmetic order', (_name, cols) => {
    const present = cols.filter((c) => order.includes(c));
    expect(present).toEqual(order.filter((c) => present.includes(c)));
  });

  it.each(FILES)('%s keeps the money block contiguous', (_name, cols) => {
    const idx = cols.map((c, i) => (order.includes(c) ? i : -1)).filter((i) => i >= 0);
    expect(idx, 'money columns are split apart').toEqual(idx.map((_, k) => idx[0] + k));
  });

  it('places the fee inputs before the total wherever both appear', () => {
    for (const [name, cols] of FILES) {
      if (!cols.includes(COL.interchange)) continue;
      expect(cols.indexOf(COL.interchange), name).toBeLessThan(cols.indexOf(COL.fees));
      expect(cols.indexOf(COL.processor), name).toBeLessThan(cols.indexOf(COL.fees));
    }
  });
});

describe('deductions', () => {
  it('decNeg always yields a negative, from either storage convention', () => {
    expect(decNeg(1000)).toBe('-10.00'); // magnitude, as Summary and Merchants hold it
    expect(decNeg(-1000)).toBe('-10.00'); // already signed, as refund gross arrives
    expect(decNeg(0)).toBe('0.00'); // not "-0.00"
    expect(decNeg(null)).toBe('');
    expect(decNeg(undefined)).toBe('');
  });

  it('never disagrees with dec on magnitude', () => {
    for (const c of [1, 999, 123456]) expect(decNeg(c)).toBe(`-${dec(c)}`);
  });

  it('every file that names a deduction names all of the ones it can carry', () => {
    // Fees is the total; a file carrying the split must carry the total too, or the
    // reader has to add it up by hand — which is what breaks.csv used to require.
    for (const [name, cols] of FILES) {
      if (cols.includes(COL.interchange)) expect(cols, name).toContain(COL.fees);
    }
  });

  it('DEDUCTIONS lists exactly the columns written negative', () => {
    expect(DEDUCTIONS).toEqual([COL.refunds, COL.interchange, COL.processor, COL.fees]);
  });
});

describe('the two Transactions files', () => {
  // They describe the same transactions from either side, so a reader should be able to
  // line them up. They differ only by the settlement view's Part column.
  it('differ only by Part', () => {
    const l = EXPORT_COLUMNS.transactionsLedger;
    const s = EXPORT_COLUMNS.transactionsSettlement;
    expect(s.filter((c) => c !== COL.part).sort()).toEqual([...l].sort());
  });

  it('both carry severity and both dates', () => {
    for (const cols of [EXPORT_COLUMNS.transactionsLedger, EXPORT_COLUMNS.transactionsSettlement]) {
      expect(cols).toContain(COL.severity);
      expect(cols).toContain(COL.capturedOn);
      expect(cols).toContain(COL.settledOn);
    }
  });
});

describe('project()', () => {
  it('orders by the header and blanks anything absent', () => {
    const cols = [COL.merchant, COL.sales, COL.fees];
    expect(project(cols, { [COL.sales]: '1.00', [COL.merchant]: 'M-1' })).toEqual(['M-1', '1.00', '']);
  });

  it('keeps a zero rather than blanking it', () => {
    expect(project([COL.sales], { [COL.sales]: 0 })).toEqual([0]);
  });

  it('ignores keys the file does not carry', () => {
    expect(project([COL.sales], { [COL.sales]: '1.00', [COL.fees]: '-2.00' })).toEqual(['1.00']);
  });
});
