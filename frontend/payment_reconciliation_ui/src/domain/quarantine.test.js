import { describe, it, expect } from 'vitest';
import { LEDGER, SETTLEMENT, quarantineReason, buildQuarantineDetail } from './quarantine.js';

// Minimal records in the shape `normalize()` produces. Amounts are integer cents, and
// `null` means the source value was absent or unparseable — which is itself a cause.
const ledger = (over) => ({
  id: 'TXN-BAD-001',
  merchantId: 'MERCH-006',
  merchantRef: 'ORD-BAD-00001',
  cardType: 'VISA',
  cardLast4: '1234',
  gross: 8800,
  currency: 'USD',
  type: 'SALE',
  capturedAt: '2026-06-08',
  category: 'QUARANTINE',
  ...over,
});

const settlement = (over) => ({
  ref: 'ARNBAD0000000000001',
  merchantRef: 'ORD-BAD-00004',
  merchantId: 'MERCH-006',
  cardType: 'VISA',
  cardLast4: '1234',
  settled: 21000,
  interchange: 150,
  processor: 40,
  currency: 'USD',
  date: '2026-06-08',
  category: 'QUARANTINE',
  ...over,
});

const labels = (d) => d.fields.map((f) => f.label);
const highlighted = (d) => d.fields.filter((f) => f.ring !== 'none').map((f) => f.label);
const valueOf = (d, label) => d.fields.find((f) => f.label === label).value;

describe('quarantineReason — ledger side', () => {
  it('blames a missing card type first', () => {
    expect(quarantineReason(ledger({ cardType: '' }), LEDGER)).toEqual({
      field: 'Card',
      text: 'Missing card type — required field absent.',
      note: null,
    });
  });

  it('blames an unparseable gross amount', () => {
    expect(quarantineReason(ledger({ gross: null }), LEDGER)).toEqual({
      field: 'Gross amount',
      text: 'Gross amount not a parseable number.',
      note: null,
    });
  });

  it('blames a non-USD currency and names it', () => {
    expect(quarantineReason(ledger({ currency: 'EUR' }), LEDGER)).toEqual({
      field: 'Currency',
      text: 'Currency EUR — non-USD records are always quarantined.',
      note: null,
    });
  });

  it('blames no field when the cause cannot be inferred', () => {
    expect(quarantineReason(ledger({}), LEDGER)).toEqual({ field: null, text: 'Failed validation.', note: null });
  });
});

// A withheld record reading $0.00 is a cause in its own right, not a fall-through: the
// value either failed to parse and was coerced to zero, or a system produced a
// transaction of nothing. Both blame the amount, so neither may reach 'Failed validation.'
describe('quarantineReason — a zero amount', () => {
  it('blames a zero gross and names the side as a sale', () => {
    const r = quarantineReason(ledger({ gross: 0 }), LEDGER);
    expect(r.field).toBe('Gross amount');
    expect(r.text).toBe('Gross amount $0.00 — unparseable input, or a system error producing a zero-value sale.');
    expect(r.note).toBeTruthy();
  });

  it('names the side as a refund on a refund row', () => {
    expect(quarantineReason(ledger({ gross: 0, type: 'REFUND' }), LEDGER).text).toBe(
      'Gross amount $0.00 — unparseable input, or a system error producing a zero-value refund.',
    );
  });

  it('blames a zero settled amount', () => {
    const r = quarantineReason(settlement({ settled: 0 }), SETTLEMENT);
    expect(r.field).toBe('Settled amount');
    expect(r.text).toBe('$0.00 a settlement of nothing or originating from an unparseable value.');
    expect(r.note).toBeTruthy();
  });

  // The zero branch sits beside the existing null branch, so it must not disturb the
  // precedence every other cause already had.
  it('still yields to a missing card type', () => {
    expect(quarantineReason(ledger({ gross: 0, cardType: '' }), LEDGER).field).toBe('Card');
  });

  it('outranks a non-USD currency, as the unparseable branch already does', () => {
    expect(quarantineReason(ledger({ gross: 0, currency: 'EUR' }), LEDGER).field).toBe('Gross amount');
    expect(quarantineReason(settlement({ settled: 0, currency: 'EUR' }), SETTLEMENT).field).toBe('Settled amount');
  });

  // Zero fees are legitimate — a refund settles at $0.00 interchange and processor fee —
  // so only the amount fields may trigger this branch.
  it('is not triggered by zero fees alone', () => {
    expect(quarantineReason(settlement({ interchange: 0, processor: 0 }), SETTLEMENT)).toEqual({
      field: null,
      text: 'Failed validation.',
      note: null,
    });
  });
});

describe('quarantineReason — settlement side', () => {
  it('blames an omitted settled amount', () => {
    expect(quarantineReason(settlement({ settled: null }), SETTLEMENT)).toEqual({
      field: 'Settled amount',
      text: 'Settled amount omitted by the processor.',
      note: null,
    });
  });

  it('blames a non-USD currency', () => {
    expect(quarantineReason(settlement({ currency: 'EUR' }), SETTLEMENT)).toEqual({
      field: 'Currency',
      text: 'Currency EUR — non-USD records are always quarantined.',
      note: null,
    });
  });

  it('blames no field when the cause cannot be inferred', () => {
    expect(quarantineReason(settlement({}), SETTLEMENT)).toEqual({ field: null, text: 'Failed validation.', note: null });
  });

  // A settlement has no card type in the ledger sense, so the ledger's first branch
  // must not leak across sides and blame every settlement for a missing card.
  it('does not apply the ledger card-type rule', () => {
    expect(quarantineReason(settlement({ cardType: '' }), SETTLEMENT).field).toBe(null);
  });
});

describe('buildQuarantineDetail', () => {
  it('highlights exactly the field the reason blames', () => {
    expect(highlighted(buildQuarantineDetail(ledger({ cardType: '' }), LEDGER))).toEqual(['Card']);
    expect(highlighted(buildQuarantineDetail(ledger({ gross: null }), LEDGER))).toEqual(['Gross amount']);
    expect(highlighted(buildQuarantineDetail(ledger({ currency: 'EUR' }), LEDGER))).toEqual(['Currency']);
    expect(highlighted(buildQuarantineDetail(settlement({ settled: null }), SETTLEMENT))).toEqual(['Settled amount']);
    expect(highlighted(buildQuarantineDetail(settlement({ currency: 'EUR' }), SETTLEMENT))).toEqual(['Currency']);
  });

  it('highlights nothing when no field is to blame', () => {
    expect(highlighted(buildQuarantineDetail(ledger({}), LEDGER))).toEqual([]);
  });

  it('highlights the amount and forwards the note for a zero amount', () => {
    const d = buildQuarantineDetail(ledger({ gross: 0 }), LEDGER);
    expect(highlighted(d)).toEqual(['Gross amount']);
    expect(valueOf(d, 'Gross amount')).toBe('$0.00');
    expect(d.note).toBeTruthy();
    expect(buildQuarantineDetail(settlement({ settled: 0 }), SETTLEMENT).note).toBeTruthy();
  });

  // The note is the detail's alone; every cause that needs no elaboration leaves it null
  // so the reason box stays two blocks rather than three.
  it('carries no note when the reason speaks for itself', () => {
    expect(buildQuarantineDetail(ledger({ cardType: '' }), LEDGER).note).toBe(null);
    expect(buildQuarantineDetail(settlement({ currency: 'EUR' }), SETTLEMENT).note).toBe(null);
  });

  it('keeps each side to its own fields', () => {
    const l = labels(buildQuarantineDetail(ledger({}), LEDGER));
    const s = labels(buildQuarantineDetail(settlement({}), SETTLEMENT));
    expect(l).toContain('Internal txn ID');
    expect(l).toContain('Type');
    expect(l).toContain('Captured');
    expect(l).not.toContain('Interchange fee');
    expect(s).toContain('Network ref');
    expect(s).toContain('Interchange fee');
    expect(s).not.toContain('Type');
    expect(s).not.toContain('Captured');
  });

  // The detail must render the record that failed, including the value that failed to
  // parse — an em dash, not a crash and not a fabricated $0.00.
  it('renders an absent amount as an em dash', () => {
    expect(valueOf(buildQuarantineDetail(ledger({ gross: null }), LEDGER), 'Gross amount')).toBe('—');
    expect(valueOf(buildQuarantineDetail(settlement({ settled: null }), SETTLEMENT), 'Settled amount')).toBe('—');
  });

  it('carries no arithmetic — a quarantined record is absent from every figure', () => {
    const d = buildQuarantineDetail(ledger({}), LEDGER);
    expect(d.math).toBeUndefined();
    expect(labels(d)).not.toContain('Impact on discrepancy');
  });
});
