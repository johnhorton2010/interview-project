// Column names and order for the five CSV exports, in one place.
//
// These lived inline in each component, which is how the same field ended up with three
// names — "Internal txn id", "Txn id" and "Ledger txn" all meant the ledger transaction
// id — and how the Breaks money block drifted out of the order every table uses. Naming
// them once makes one-name-per-field structural rather than a rename that can drift again.

/** Canonical name for each field. A field has exactly one name across every export. */
export const COL = {
  category: 'Category',
  severity: 'Severity',
  merchant: 'Merchant',
  merchantRef: 'Merchant ref',
  txnId: 'Txn id',
  // Singular even in the ledger view, where the cell holds a space-joined list: one file
  // folding several refs into a cell is a shape difference, not a different field.
  networkRef: 'Network ref',
  part: 'Part',
  capturedOn: 'Captured on',
  settledOn: 'Settled on',
  totalN: 'Total n',
  ledgerN: 'Ledger n',
  settleN: 'Settle n',
  sales: 'Sales',
  refunds: 'Refunds',
  interchange: 'Interchange',
  processor: 'Processor',
  fees: 'Fees',
  expected: 'Exp pay',
  settled: 'Settled',
  discrepancy: 'Discrepancy',
  clean: 'Clean',
  breaks: 'Breaks',
  quarantine: 'Quarantine',
};

// The money block in the order every table lays it out: each total after its own inputs,
// so the columns read as the arithmetic. Shared so the order cannot drift per file.
const MONEY_FULL = [COL.sales, COL.refunds, COL.interchange, COL.processor, COL.fees, COL.expected, COL.settled, COL.discrepancy];
const MONEY_TOTALS = [COL.sales, COL.refunds, COL.fees, COL.expected, COL.settled, COL.discrepancy];

/** Columns written as negatives — the deduction convention the screen uses. */
export const DEDUCTIONS = [COL.refunds, COL.interchange, COL.processor, COL.fees];

export const EXPORT_COLUMNS = {
  summary: [COL.category, COL.severity, COL.totalN, COL.ledgerN, COL.settleN, ...MONEY_TOTALS],

  merchants: [COL.merchant, ...MONEY_FULL, COL.clean, COL.breaks, COL.quarantine],

  // One line per settlement, so it carries the fee split like the merchant rollup, plus
  // `Part` to order the lines a multi-settlement break expands into.
  breaks: [
    COL.category, COL.severity, COL.merchant, COL.merchantRef,
    COL.txnId, COL.networkRef, COL.part, COL.capturedOn, COL.settledOn,
    ...MONEY_FULL,
  ],

  // The two Transactions files describe the same transactions from either side, so they
  // carry the same date and classification columns and differ only by `Part`.
  transactionsLedger: [
    COL.txnId, COL.networkRef, COL.capturedOn, COL.settledOn, COL.merchant, COL.merchantRef,
    ...MONEY_TOTALS,
    COL.category, COL.severity,
  ],

  transactionsSettlement: [
    COL.networkRef, COL.part, COL.txnId, COL.capturedOn, COL.settledOn, COL.merchant, COL.merchantRef,
    ...MONEY_TOTALS,
    COL.category, COL.severity,
  ],
};

/**
 * Project a name-keyed row object through a file's column order.
 *
 * Rows are built by name rather than by position because the alternative — an array whose
 * indices must stay in lockstep with the header — is what the Breaks exporter used to do,
 * complete with a comment warning about it. Adding or reordering a column now cannot
 * silently shift every value one cell to the left.
 */
export const project = (columns, row) => columns.map((c) => (row[c] === undefined ? '' : row[c]));
