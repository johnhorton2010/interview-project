// Client-side import guards. These run before any upload, so a rejection here is the
// only feedback the analyst gets — the messages are the contract, and App.test.jsx
// asserts a couple of them reach the screen. This file covers the rest of the branches.
import { describe, it, expect } from 'vitest';
import { validateLedgerFile } from './ledger.js';
import { validateSettlementFile, parseAndValidateSettlements } from './settlements.js';

const file = (name, type, size = 10) => ({ name, type, size });

describe('validateLedgerFile', () => {
  it('accepts a .csv by extension or by MIME type', () => {
    expect(() => validateLedgerFile(file('internal_transactions.csv', ''))).not.toThrow();
    expect(() => validateLedgerFile(file('export', 'text/csv'))).not.toThrow();
    expect(() => validateLedgerFile(file('LEDGER.CSV', ''))).not.toThrow();
  });

  it.each([
    [undefined, 'No file selected.'],
    [file('notes.txt', 'text/plain'), 'Expected a .csv file (the internal ledger export).'],
    [file('empty.csv', 'text/csv', 0), 'That file is empty.'],
    [file('huge.csv', 'text/csv', 10 * 1024 * 1024 + 1), 'File is larger than 10 MB.'],
  ])('rejects %o', (input, message) => {
    expect(() => validateLedgerFile(input)).toThrow(message);
  });
});

describe('validateSettlementFile', () => {
  it('accepts a .json by extension or by MIME type', () => {
    expect(() => validateSettlementFile(file('processor_settlement.json', ''))).not.toThrow();
    expect(() => validateSettlementFile(file('export', 'application/json'))).not.toThrow();
  });

  it.each([
    [undefined, 'No file selected.'],
    [file('ledger.csv', 'text/csv'), 'Expected a .json file (the processor settlement export).'],
    [file('empty.json', 'application/json', 0), 'That file is empty.'],
    [file('huge.json', 'application/json', 10 * 1024 * 1024 + 1), 'File is larger than 10 MB.'],
  ])('rejects %o', (input, message) => {
    expect(() => validateSettlementFile(input)).toThrow(message);
  });
});

describe('parseAndValidateSettlements', () => {
  it('returns the parsed array unmodified', () => {
    // PRD §5.2: no coercion, no key renaming — what the processor sent is what we send on.
    const text = '[{"network_ref":"ARN0001","settled_amount":"351.60","extra":null}]';
    expect(parseAndValidateSettlements(text)).toEqual([
      { network_ref: 'ARN0001', settled_amount: '351.60', extra: null },
    ]);
  });

  it('accepts the camelCase spelling of the ref', () => {
    expect(parseAndValidateSettlements('[{"networkRef":"ARN0001"}]')).toHaveLength(1);
  });

  it.each([
    ['{oops', 'That file is not valid JSON.'],
    ['{}', 'The settlement file must be a JSON array at its root.'],
    ['[]', 'The settlement array is empty.'],
    ['[42]', 'Element at index 0 is not an object.'],
    ['[null]', 'Element at index 0 is not an object.'],
    ['[[]]', 'Element at index 0 is not an object.'],
    ['[{"amount":1}]', 'Element at index 0 is missing a non-empty "network_ref".'],
    ['[{"network_ref":"   "}]', 'Element at index 0 is missing a non-empty "network_ref".'],
  ])('rejects %s', (text, message) => {
    expect(() => parseAndValidateSettlements(text)).toThrow(message);
  });

  it('names the offending index rather than the first one', () => {
    const text = '[{"network_ref":"ARN0001"},{"network_ref":""}]';
    expect(() => parseAndValidateSettlements(text)).toThrow('Element at index 1');
  });
});
