// What every column means, in one place. Wording follows PRD §7.3–7.6, which is the
// authoritative definition of each figure.
//
// The structure mirrors the PRD's own: §7.6 defines the merchant rollup as "the §7.3
// definitions restricted to that merchant", and that is exactly how the copy composes —
// one shared definition per figure, plus a scope clause saying whose records it covers.
// Without the scope clause the same sentence would sit above a per-category total and a
// single record and be wrong about one of them.

/** Shared definitions. Identical wherever the column appears. */
export const FIGURE = {
  sales: 'Gross sale amount.',
  refunds: 'Gross refund amount.',
  interchange: "Interchange fee — the card network's share.",
  processor: "Processor fee — the processor's own share.",
  fees: 'Total fees the processor deducted.\nFees = interchange + processor.',
  expected: 'What the processor should have paid.\nExp pay = sales − refunds − fees.',
  settled: 'What the processor actually paid.',
  discrepancy:
    'What is unaccounted for.\nDiscrepancy = exp pay − settled.\nPositive means it settled less than expected (owed to us); negative means it settled more.',
  merchantRef: "The merchant's own reference for the order.",
  captured: 'The date the ledger recorded the transaction.',
  count: 'How many rows this total covers.',
};

/** Whose records a figure covers. This is where most cross-tab deviation lives. */
export const SCOPE = {
  category: 'Totalled over every record in this category.',
  merchant: 'Totalled over every record for this merchant.',
  row: 'For this record.',
  payout: 'For this payout only — the columns beside it cover the whole transaction.',
  transaction: 'Belongs to the whole transaction; later payouts repeat it as 〃.',
  visible: 'Totalled over every row currently on screen; filters apply.',
};

/** Join the parts of one tooltip. Falsy parts drop out so callers can pass conditionals. */
export const help = (...parts) => parts.filter(Boolean).join('\n');

// ---- per-table maps, keyed by the column keys in each table's SPEC ----------

export const SUMMARY_HELP = {
  // The row *is* a category here, unlike Breaks and Transactions where it classifies a record.
  category: 'The reconciliation outcome this row groups.',
  severity: 'How much attention this category needs: high, medium, low, none or excluded.',
  totalCount:
    'Reconciled rows in this category.',
  sides: 'Ledger-side records / Settlement-side records in this category.',
  sales: help(FIGURE.sales, SCOPE.category),
  refunds: help(FIGURE.refunds, SCOPE.category),
  fees: help(FIGURE.fees, SCOPE.category),
  expected: help(FIGURE.expected, SCOPE.category),
  settled: help(FIGURE.settled, SCOPE.category),
  impact: help(FIGURE.discrepancy, SCOPE.category),
};

export const MERCHANT_HELP = {
  // The row *is* a merchant here, unlike everywhere else where it is a field on a record.
  merchant: 'The merchant id this rollup covers.',
  sales: help(FIGURE.sales, SCOPE.merchant),
  refunds: help(FIGURE.refunds, SCOPE.merchant),
  interchange: help(FIGURE.interchange, SCOPE.merchant),
  processor: help(FIGURE.processor, SCOPE.merchant),
  // The only table that shows the two inputs as their own columns, so it can point at them.
  fees: help(FIGURE.fees, 'Interchg and Proc are the two columns to its left.', SCOPE.merchant),
  expected: help(FIGURE.expected, SCOPE.merchant),
  settled: help(FIGURE.settled, SCOPE.merchant),
  discrepancy: help(FIGURE.discrepancy, SCOPE.merchant),
  clean: 'Records that reconciled cleanly.',
  breaks: 'Records with a reconciliation break — anything that is not a clean match.',
  quarantine:
    'Records withheld from every calculation on this report,.\nA merchant whose records are all quarantined reads N/A across the money columns and appears only here.',
};

export const BREAKS_HELP = {
  category: help('The reconciliation outcome — how the ledger and settlement sides compared.', SCOPE.row),
  merchant: help('The merchant the record belongs to.', SCOPE.row),
  ref: help(FIGURE.merchantRef, 'For this record.'),
  sales: help(FIGURE.sales, SCOPE.row, 'Reads — when this record is a refund.'),
  refunds: help(FIGURE.refunds, SCOPE.row, 'Reads — when this record is a sale.'),
  fees: help(FIGURE.fees, SCOPE.row, 'Reads — when nothing settled.'),
  expected: help(FIGURE.expected, SCOPE.row),
  settled: help(FIGURE.settled, SCOPE.row),
  impact: help(FIGURE.discrepancy, SCOPE.row),
  captured: help(FIGURE.captured, SCOPE.row),
  // Deviates from the Transactions settlement view, where the same label means this
  // payout's date. Here it is the latest of however many the record has (normalize.js).
  date: help('The date the settlement recorded.', SCOPE.row),
};

/**
 * Transactions swaps six of these with the view: the id and date columns change what they
 * identify, and the money columns change whose figures they carry. In settlement view a
 * transaction spans several rows, so Fees and Settled are per-payout while the ledger-side
 * figures beside them belong to the transaction and repeat as 〃.
 */
export const transactionsHelp = (settleCentric) => {
  const money = settleCentric ? SCOPE.transaction : SCOPE.row;
  return {
    id: settleCentric
      ? "The processor's network reference for this payout. Click to copy."
      : 'The internal ledger transaction id with the processor settlement id sublined. Click to copy either.',
    captured: settleCentric ? 'The date this payout settled.' : help(FIGURE.captured, SCOPE.row),
    merchant: help('The merchant id the record belongs to.', SCOPE.row),
    ref: help(FIGURE.merchantRef, SCOPE.row),
    sales: help(FIGURE.sales, money),
    refunds: help(FIGURE.refunds, money),
    fees: help(FIGURE.fees, settleCentric ? SCOPE.payout : SCOPE.row),
    expected: help(FIGURE.expected, money),
    settled: help(FIGURE.settled, settleCentric ? SCOPE.payout : SCOPE.row),
    disc: help(FIGURE.discrepancy, money),
    category: help('The reconciliation outcome — how the ledger and settlement sides compared.', SCOPE.row),
  };
};

/**
 * Help for the label rows that Transactions restates inside its section bands.
 *
 * These cannot reuse the header map above, because a band exists precisely *because* one
 * of its columns means something else inside it. Copying the header's wording down would
 * describe the opposite of what the band's rows hold.
 */
export const BAND_HELP = {
  /**
   * Ledger view, "Unattributed settlements". These rows have no ledger side, so the id
   * column carries the settlement's own reference — the inverse of the Txn id the header
   * names in this view. Everything else is per-record, as in the rest of the view.
   */
  unattributed: {
    ...transactionsHelp(false),
    id: help(
      "The processor settlement id.",
      SCOPE.row,
    ),
    captured: help(FIGURE.captured, "These rows have no ledger side, so the column reads 'no ledger'.", SCOPE.row),
  },

  /**
   * Settlement view, "Never settled". Built from the *ledger* map even though its labels
   * come from the settlement one: these rows are one per transaction, not one per payout
   * — they have no payout at all — so the settlement map's "for this payout only" would
   * be wrong on every column it touches.
   */
  neverSettled: {
    ...transactionsHelp(false),
    id: help(
      'The internal ledger transaction id.',
      'These rows never settled, so there is no network reference and the id column falls back to the ledger id.',
      SCOPE.row,
    ),
    captured: help('The date the processor paid out.', "These rows never settled, so the column reads 'unsettled'.", SCOPE.row),
  },

  /**
   * The band above the grand total, in both views. Four labels are blank there and must
   * stay without help; `ref` is relabelled Count.
   */
  grand: () => ({
    ref: help('The count of rows', SCOPE.visible),
    sales: help(FIGURE.sales, SCOPE.visible),
    refunds: help(FIGURE.refunds, SCOPE.visible),
    fees: help(FIGURE.fees, SCOPE.visible),
    expected: help(FIGURE.expected, SCOPE.visible),
    settled: help(FIGURE.settled, SCOPE.visible),
    disc: help(FIGURE.discrepancy, SCOPE.visible),
  }),
};

export const QUARANTINE_HELP = {
  side: "Which file the record came from — the internal ledger, or the processor's settlement file.",
  id: "The record's own id: a ledger transaction id, or a network reference for a settlement.",
  merchant: 'The merchant on the withheld record.',
  // Not one of the report's money columns — whichever amount that side happens to carry.
  amount:
    "The record's own amount — gross for a ledger transaction, settled for a settlement.\nReads — when the source omitted it.",
  reason: 'The validation rule this record failed. Fix at source, then reset and re-import.',
};
