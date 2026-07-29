// Golden-figure tests: normalise the sample payload and assert the PRD §11 values.
import { describe, it, expect } from 'vitest';
import { normalize } from './normalize.js';
import { figures, categorySummary, merchantRollup } from './selectors.js';
import { buildSamplePayload } from '../test/fixtures/sampleReconciliation.js';

const model = normalize(buildSamplePayload());
const f = figures(model);

describe('normalisation (AC-5, AC-6, AC-9, AC-10)', () => {
  it('recovers 19 rows: 18 ledger-anchored + 1 settlement-only', () => {
    expect(model.rows.length).toBe(19);
    expect(model.rows.filter((r) => r.ledger).length).toBe(18);
    const settlementOnly = model.rows.filter((r) => !r.ledger);
    expect(settlementOnly.length).toBe(1);
    expect(settlementOnly[0].id).toBe('ARN74000000000000058801');
  });

  it('recovers 18 unique ledger transactions and 19 unique settlements', () => {
    expect(model.ledger.length).toBe(18);
    expect(model.settle.length).toBe(19);
    // repeated records collapse to one
    expect(model.rows.filter((r) => r.id === 'TXN-000012').length).toBe(1);
    expect(model.rows.filter((r) => r.id === 'TXN-000015').length).toBe(1);
  });

  it('sources unmatched/quarantine categories from the opposite map (AC-7)', () => {
    const byId = Object.fromEntries(model.rows.map((r) => [r.id, r]));
    expect(byId['TXN-000009'].category).toBe('UNMATCHED_INTERNAL');
    expect(byId['TXN-BAD-001'].category).toBe('QUARANTINE');
    expect(byId['TXN-BAD-002'].category).toBe('QUARANTINE');
    expect(byId['TXN-BAD-003'].category).toBe('QUARANTINE');
  });

  it('links the blank-merchant_ref settlement to its ledger row (AC-8)', () => {
    const row = model.rows.find((r) => r.id === 'TXN-000001');
    expect(row.settlements.map((s) => s.ref)).toContain('ARN74000000000000008077');
  });

  it('counts included vs quarantined records (AC-9, AC-10)', () => {
    expect(f.includedLedger).toBe(15);
    expect(f.includedSettle).toBe(17);
    expect(model.ledger.filter((l) => l.category === 'QUARANTINE').length).toBe(3);
    expect(model.settle.filter((s) => s.category === 'QUARANTINE').length).toBe(2);
  });
});

describe('headline figures — exact values (AC-11..AC-19)', () => {
  it('matches every headline figure in cents', () => {
    expect(f.sales).toBe(680412); // AC-11 $6,804.12
    expect(f.refunds).toBe(155702); // AC-12 $1,557.02
    expect(f.interchange).toBe(13048); // AC-13 $130.48
    expect(f.processor).toBe(2126); // AC-14 $21.26
    expect(f.fees).toBe(15174); // AC-15 $151.74
    expect(f.expected).toBe(509536); // AC-16 $5,095.36
    expect(f.actual).toBe(516100); // AC-17 $5,161.00
    expect(f.discrepancy).toBe(-6564); // AC-18 −$65.64
    expect(f.breakCount).toBe(8); // AC-19
  });
});

describe('category summary — exact values (AC-20)', () => {
  const { rows } = categorySummary(model);
  const byKey = Object.fromEntries(rows.map((c) => [c.key, c]));

  it('impact column sums to the headline discrepancy', () => {
    const sum = model.rows.reduce((n, r) => (r.category === 'QUARANTINE' ? n : n + r.rowImpact), 0);
    expect(sum).toBe(-6564);
  });

  it('reproduces the per-category figures', () => {
    expect(byKey.DUPLICATE.rawLedgerN).toBe(1);
    expect(byKey.DUPLICATE.rawSettleN).toBe(2);
    expect(byKey.DUPLICATE.rawSettled).toBe(45916);
    expect(byKey.DUPLICATE.rawImpact).toBe(-23465);
    expect(byKey.UNMATCHED_INTERNAL.rawImpact).toBe(23311);
    expect(byKey.UNMATCHED_SETTLEMENT.rawImpact).toBe(-6760);
    expect(byKey.AMOUNT_MISMATCH.rawImpact).toBe(350);
    // QUARANTINE row is displayed but excluded from included totals (AC-20a)
    expect(byKey.QUARANTINE.totalCount).toBe(5); // 3 ledger + 2 settlement
  });
});

describe('per-merchant rollup — exact values (AC-21)', () => {
  const { rows } = merchantRollup(model);
  const byId = Object.fromEntries(rows.map((m) => [m.merchantId, m]));

  it('surfaces the fully-quarantined merchant as a quarantine-only N/A row', () => {
    // Design behaviour: MERCH-003 appears with N/A figures and quarantineOnly=true
    // (hidden by the default "only merchants with breaks" toggle). This diverges from
    // PRD §7.6/AC-21, which says it never appears; we follow the design for the UI.
    expect(byId['MERCH-003']).toBeDefined();
    expect(byId['MERCH-003'].raw.quarantineOnly).toBe(true);
    expect(byId['MERCH-003'].hasBreaks).toBe(false);
  });

  it('reproduces discrepancy and break counts per merchant', () => {
    expect(byId['MERCH-002'].raw.disc).toBe(23311);
    expect(byId['MERCH-004'].raw.disc).toBe(-6760);
    expect(byId['MERCH-004'].raw.breaks).toBe(3);
    expect(byId['MERCH-006'].raw.disc).toBe(350);
    expect(byId['MERCH-008'].raw.disc).toBe(-23465);
  });

  it('discrepancy and break columns sum to the headline totals (AC-21a)', () => {
    const discSum = rows.reduce((n, m) => n + (m.raw.quarantineOnly ? 0 : m.raw.disc), 0);
    const breakSum = rows.reduce((n, m) => n + (m.raw.quarantineOnly ? 0 : m.raw.breaks), 0);
    expect(discSum).toBe(-6564);
    expect(breakSum).toBe(8);
  });
});

describe('malformed-payload guard (PRD D4)', () => {
  it('throws when the canonical settlement→internal map is missing', () => {
    expect(() => normalize({ internalTransactionToProcessorSettlementsMap: {} })).toThrow(
      /processorSettlementToInternalTransactionsMap is missing/,
    );
  });
});
