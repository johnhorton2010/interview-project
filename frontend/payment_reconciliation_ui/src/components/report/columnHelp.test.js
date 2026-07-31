import { describe, it, expect } from 'vitest';
import {
  FIGURE,
  SCOPE,
  help,
  SUMMARY_HELP,
  MERCHANT_HELP,
  BREAKS_HELP,
  QUARANTINE_HELP,
  BAND_HELP,
  transactionsHelp,
} from './columnHelp.js';

// The failure mode here is silent: a column gains a header and simply has no tooltip,
// which nothing about the running app makes obvious. These pin the two together.

/** Column keys each table renders a labelled header for — its SPEC minus `caret`. */
const COLUMNS = {
  summary: ['category', 'severity', 'totalCount', 'sides', 'sales', 'refunds', 'fees', 'expected', 'settled', 'impact'],
  merchants: ['merchant', 'sales', 'refunds', 'interchange', 'processor', 'fees', 'expected', 'settled', 'discrepancy', 'clean', 'breaks', 'quarantine'],
  breaks: ['category', 'merchant', 'ref', 'sales', 'refunds', 'fees', 'expected', 'settled', 'impact', 'captured', 'date'],
  transactions: ['id', 'captured', 'merchant', 'ref', 'sales', 'refunds', 'fees', 'expected', 'settled', 'disc', 'category'],
  quarantine: ['side', 'id', 'merchant', 'amount', 'reason'],
};

const MAPS = {
  summary: SUMMARY_HELP,
  merchants: MERCHANT_HELP,
  breaks: BREAKS_HELP,
  quarantine: QUARANTINE_HELP,
  'transactions (ledger)': transactionsHelp(false),
  'transactions (settlement)': transactionsHelp(true),
};

describe('every labelled column has help', () => {
  it.each(Object.entries(MAPS))('%s', (name, map) => {
    const keys = COLUMNS[name.startsWith('transactions') ? 'transactions' : name];
    for (const k of keys) {
      expect(map[k], `${name}.${k}`).toBeTruthy();
      expect(map[k].length, `${name}.${k} too short to be a definition`).toBeGreaterThan(15);
    }
  });

  it('defines nothing it does not render', () => {
    for (const [name, map] of Object.entries(MAPS)) {
      const keys = COLUMNS[name.startsWith('transactions') ? 'transactions' : name];
      expect(Object.keys(map).sort(), name).toEqual([...keys].sort());
    }
  });
});

describe('derived columns state their arithmetic', () => {
  // Requirement: a column you cannot compute from the screen must say how it is computed.
  it('fees names both inputs', () => {
    expect(FIGURE.fees).toMatch(/interchange \+ processor/);
  });

  it('expected pay names all three inputs', () => {
    expect(FIGURE.expected).toMatch(/sales − refunds − fees/);
  });

  it('discrepancy names its inputs and which way its sign runs', () => {
    expect(FIGURE.discrepancy).toMatch(/exp pay − settled/);
    expect(FIGURE.discrepancy).toMatch(/settled less than expected/);
  });

  it('carries the formula through to every table that shows the column', () => {
    for (const [name, map] of Object.entries(MAPS)) {
      if (map.fees) expect(map.fees, name).toMatch(/interchange \+ processor/);
      if (map.expected) expect(map.expected, name).toMatch(/sales − refunds − fees/);
    }
  });
});

describe('scope', () => {
  // The same definition sits above a per-category total, a per-merchant total and a
  // single record. Without the scope line it is wrong about two of the three.
  it('every money column says whose records it covers', () => {
    const scopes = Object.values(SCOPE);
    const money = ['sales', 'refunds', 'expected', 'settled'];
    for (const [name, map] of Object.entries(MAPS)) {
      for (const k of money) {
        if (!map[k]) continue;
        expect(scopes.some((s) => map[k].includes(s)), `${name}.${k} has no scope line`).toBe(true);
      }
    }
  });

  it('the settlement view marks Settled and Fees as per-payout', () => {
    const s = transactionsHelp(true);
    expect(s.settled).toContain(SCOPE.payout);
    expect(s.fees).toContain(SCOPE.payout);
    // …while the ledger-side figures beside them belong to the whole transaction.
    expect(s.sales).toContain(SCOPE.transaction);
    expect(s.disc).toContain(SCOPE.transaction);
  });

  it('the ledger view scopes every money column to the record', () => {
    const l = transactionsHelp(false);
    for (const k of ['sales', 'refunds', 'fees', 'expected', 'settled', 'disc']) {
      expect(l[k], k).toContain(SCOPE.row);
    }
  });
});

describe('the documented cross-tab deviations are real', () => {
  it('Settled on means different things on Breaks and in the settlement view', () => {
    expect(BREAKS_HELP.date).not.toBe(transactionsHelp(true).captured);
    expect(BREAKS_HELP.date).toMatch(/most recent/);
    expect(transactionsHelp(true).captured).toMatch(/this payout/);
  });

  it('Category and Merchant read differently where the row is the thing', () => {
    expect(SUMMARY_HELP.category).not.toBe(BREAKS_HELP.category);
    expect(MERCHANT_HELP.merchant).not.toBe(BREAKS_HELP.merchant);
  });

  it('the id column swaps meaning with the view', () => {
    expect(transactionsHelp(false).id).not.toBe(transactionsHelp(true).id);
  });
});

// Transactions restates its column labels inside three mid-table bands. Those are not
// `role="columnheader"`, so the assertions above walked straight past them and reported
// full coverage while all 29 slots had no help at all. These close that hole.
describe('section band labels', () => {
  // Every LSPEC key the bands render a non-empty label for.
  const CAPTIONED = ['id', 'captured', 'merchant', 'ref', 'sales', 'refunds', 'fees', 'expected', 'settled', 'disc', 'category'];
  const GRAND = ['ref', 'sales', 'refunds', 'fees', 'expected', 'settled', 'disc'];

  it.each([
    ['unattributed', BAND_HELP.unattributed, CAPTIONED],
    ['neverSettled', BAND_HELP.neverSettled, CAPTIONED],
    ['grand (ledger)', BAND_HELP.grand(false), GRAND],
    ['grand (settlement)', BAND_HELP.grand(true), GRAND],
  ])('%s covers every label it renders', (name, map, keys) => {
    for (const k of keys) expect(map[k], `${name}.${k}`).toBeTruthy();
  });

  it('the grand band defines nothing for the slots it blanks', () => {
    // grandBandLabels blanks id/captured/merchant/category — hovering an empty slot must
    // show nothing rather than describing a column that is not labelled there.
    for (const k of ['id', 'captured', 'merchant', 'category']) {
      expect(BAND_HELP.grand(false)[k], k).toBeUndefined();
      expect(BAND_HELP.grand(true)[k], k).toBeUndefined();
    }
  });

  // A band exists *because* a column means something else inside it. If these ever match
  // the header, the band is describing the opposite of what its rows hold.
  it('the id column is inverted relative to the header of the view it sits in', () => {
    expect(BAND_HELP.unattributed.id).not.toBe(transactionsHelp(false).id);
    expect(BAND_HELP.unattributed.id).toMatch(/network reference/i);

    expect(BAND_HELP.neverSettled.id).not.toBe(transactionsHelp(true).id);
    expect(BAND_HELP.neverSettled.id).toMatch(/ledger transaction id/i);
  });

  it('never-settled scopes its money columns to the record, not the payout', () => {
    // Its rows are one per transaction — they have no payout — even though the band sits
    // inside the settlement view, whose header scopes these to the payout.
    for (const k of ['sales', 'refunds', 'fees', 'expected', 'settled', 'disc']) {
      expect(BAND_HELP.neverSettled[k], k).toContain(SCOPE.row);
      expect(BAND_HELP.neverSettled[k], k).not.toContain(SCOPE.payout);
    }
  });

  it('both captioned bands explain the marker their rows print', () => {
    expect(BAND_HELP.unattributed.captured).toMatch(/no ledger/);
    expect(BAND_HELP.neverSettled.captured).toMatch(/unsettled/);
  });

  it('Count states its unit, which differs by view', () => {
    const l = BAND_HELP.grand(false).ref;
    const s = BAND_HELP.grand(true).ref;
    expect(l).not.toBe(s);
    expect(l).toMatch(/one row per ledger transaction/i);
    expect(s).toMatch(/one row per payout/i);
  });

  it('grand-total money columns say the totals follow the filters', () => {
    for (const k of ['sales', 'refunds', 'fees', 'expected', 'settled', 'disc']) {
      expect(BAND_HELP.grand(false)[k], k).toContain(SCOPE.visible);
    }
  });
});

describe('help()', () => {
  it('joins on newlines and drops falsy parts', () => {
    expect(help('a', null, 'b', undefined, '')).toBe('a\nb');
  });
});
