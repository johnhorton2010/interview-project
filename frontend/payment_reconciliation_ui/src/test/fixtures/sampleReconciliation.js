// Golden fixture: the sample dataset from the PRD/design, assembled into the exact
// three-map GET /reconciliations shape the backend returns. The ledger,
// settlement, link and category data below are the design component's own preview
// data, which is the sample the PRD's acceptance criteria (§11) are stated against.

// [id, merchantId, merchantRef, cardType, cardLast4, gross, type, capturedDate, category]
const LEDGER = [
  ['TXN-000001', 'MERCH-005', 'ORD-005-52445', 'MASTERCARD', '9202', '775.32', 'SALE', '2026-06-06', 'CLEAN_MATCH'],
  ['TXN-000002', 'MERCH-001', 'ORD-001-95319', 'DISCOVER', '2285', '599.87', 'SALE', '2026-06-02', 'CLEAN_MATCH'],
  ['TXN-000003', 'MERCH-001', 'ORD-001-95319', 'DISCOVER', '2285', '-383.21', 'REFUND', '2026-06-03', 'CLEAN_MATCH'],
  ['TXN-000004', 'MERCH-002', 'ORD-002-61750', 'VISA', '4934', '825.19', 'SALE', '2026-06-08', 'CLEAN_MATCH'],
  ['TXN-000005', 'MERCH-006', 'ORD-006-57931', 'VISA', '3003', '757.81', 'SALE', '2026-06-03', 'AMOUNT_MISMATCH'],
  ['TXN-000006', 'MERCH-006', 'ORD-006-29772', 'MASTERCARD', '1241', '351.60', 'SALE', '2026-06-06', 'CLEAN_MATCH'],
  ['TXN-000007', 'MERCH-006', 'ORD-006-29772', 'MASTERCARD', '1241', '-336.42', 'REFUND', '2026-06-07', 'CLEAN_MATCH'],
  ['TXN-000008', 'MERCH-006', 'ORD-006-86387', 'VISA', '0831', '712.51', 'SALE', '2026-06-05', 'FEE_DISCREPANCY'],
  ['TXN-000009', 'MERCH-002', 'ORD-002-88104', 'VISA', '6612', '233.11', 'SALE', '2026-06-07', 'UNMATCHED_INTERNAL'],
  ['TXN-000010', 'MERCH-007', 'ORD-007-19494', 'VISA', '1330', '737.93', 'SALE', '2026-06-09', 'CLEAN_MATCH'],
  ['TXN-000011', 'MERCH-008', 'ORD-008-16328', 'VISA', '5915', '389.50', 'SALE', '2026-06-04', 'CLEAN_MATCH'],
  ['TXN-000012', 'MERCH-008', 'ORD-008-17602', 'VISA', '4143', '234.65', 'SALE', '2026-06-02', 'DUPLICATE'],
  ['TXN-000013', 'MERCH-008', 'ORD-008-76510', 'VISA', '7203', '-837.39', 'REFUND', '2026-06-10', 'ORPHAN_REFUND'],
  ['TXN-000014', 'MERCH-004', 'ORD-004-38140', 'VISA', '5967', '355.21', 'SALE', '2026-06-01', 'WIDE_WINDOW'],
  ['TXN-000015', 'MERCH-004', 'ORD-004-14914', 'MASTERCARD', '0811', '831.42', 'SALE', '2026-06-03', 'SPLIT'],
  ['TXN-BAD-001', 'MERCH-006', 'ORD-BAD-00001', '', '1234', '88.00', 'SALE', '2026-06-08', 'QUARANTINE'],
  ['TXN-BAD-002', 'MERCH-003', 'ORD-BAD-00002', 'VISA', '4111', 'N/A', 'SALE', '2026-06-08', 'QUARANTINE'],
  ['TXN-BAD-003', 'MERCH-007', 'ORD-BAD-00003', 'AMEX', '9999', '120.00', 'SALE', '2026-06-09', 'QUARANTINE'],
];
const LEDGER_CCY = { 'TXN-BAD-003': 'EUR' };

// [ref, merchantRef, merchantId, cardType, cardLast4, settled, interchange, processor, currency, date]
const SETTLE = [
  ['ARN74000000000000036173', 'ORD-006-57931', 'MERCH-006', 'VISA', '3003', '738.25', '13.74', '2.32', 'USD', '2026-06-05'],
  ['ARN74000000000000050652', 'ORD-001-95319', 'MERCH-001', 'DISCOVER', '2285', '585.92', '12.10', '1.85', 'USD', '2026-06-04'],
  ['ARN74000000000000078631', 'ORD-008-17602', 'MERCH-008', 'VISA', '4143', '229.58', '4.32', '0.75', 'USD', '2026-06-04'],
  ['ARN74000000000000010991', 'ORD-008-17602', 'MERCH-008', 'VISA', '4143', '229.58', '4.32', '0.75', 'USD', '2026-06-04'],
  ['ARN74000000000000058801', 'ORD-004-22337', 'MERCH-004', 'MASTERCARD', '9062', '65.97', '1.38', '0.25', 'USD', '2026-06-10'],
  ['ARN74000000000000052710', 'ORD-008-76510', 'MERCH-008', 'VISA', '7203', '-837.39', '0.00', '0.00', 'USD', '2026-06-11'],
  ['ARNBAD0000000000002', 'ORD-BAD-00005', 'MERCH-007', 'AMEX', '9999', '210.00', '5.25', '0.68', 'EUR', '2026-06-09'],
  ['ARN74000000000000005568', 'ORD-002-61750', 'MERCH-002', 'VISA', '4934', '807.71', '14.95', '2.53', 'USD', '2026-06-10'],
  ['ARN74000000000000048583', 'ORD-006-29772', 'MERCH-006', 'MASTERCARD', '1241', '343.72', '6.78', '1.10', 'USD', '2026-06-08'],
  ['ARNBAD0000000000001', 'ORD-BAD-00004', 'MERCH-006', 'VISA', '1234', null, '1.50', '0.40', 'USD', '2026-06-08'],
  ['ARN74000000000000052411', 'ORD-006-86387', 'MERCH-006', 'VISA', '0831', '695.14', '15.18', '2.19', 'USD', '2026-06-07'],
  ['ARN74000000000000058376', 'ORD-006-29772', 'MERCH-006', 'MASTERCARD', '1241', '-336.42', '0.00', '0.00', 'USD', '2026-06-09'],
  ['ARN74000000000000089290', 'ORD-007-19494', 'MERCH-007', 'VISA', '1330', '722.29', '13.38', '2.26', 'USD', '2026-06-11'],
  ['ARN74000000000000088600', 'ORD-004-14914', 'MERCH-004', 'MASTERCARD', '0811', '487.79', '9.54', '1.52', 'USD', '2026-06-05'],
  ['ARN74000000000000008077', '', 'MERCH-005', 'MASTERCARD', '9202', '758.11', '14.83', '2.38', 'USD', '2026-06-09'],
  ['ARN74000000000000055189', 'ORD-008-16328', 'MERCH-008', 'VISA', '5915', '381.17', '7.11', '1.22', 'USD', '2026-06-06'],
  ['ARN74000000000000030348', 'ORD-004-38140', 'MERCH-004', 'VISA', '5967', '347.60', '6.49', '1.12', 'USD', '2026-06-19'],
  ['ARN74000000000000075688', 'ORD-004-14914', 'MERCH-004', 'MASTERCARD', '0811', '325.19', '6.36', '1.02', 'USD', '2026-06-05'],
  ['ARN74000000000000076360', 'ORD-001-95319', 'MERCH-001', 'DISCOVER', '2285', '-383.21', '0.00', '0.00', 'USD', '2026-06-05'],
];

// internal_txn_id -> [network_ref, ...]
const LINKS = {
  'TXN-000001': ['ARN74000000000000008077'],
  'TXN-000002': ['ARN74000000000000050652'],
  'TXN-000003': ['ARN74000000000000076360'],
  'TXN-000004': ['ARN74000000000000005568'],
  'TXN-000005': ['ARN74000000000000036173'],
  'TXN-000006': ['ARN74000000000000048583'],
  'TXN-000007': ['ARN74000000000000058376'],
  'TXN-000008': ['ARN74000000000000052411'],
  'TXN-000009': [],
  'TXN-000010': ['ARN74000000000000089290'],
  'TXN-000011': ['ARN74000000000000055189'],
  'TXN-000012': ['ARN74000000000000078631', 'ARN74000000000000010991'],
  'TXN-000013': ['ARN74000000000000052710'],
  'TXN-000014': ['ARN74000000000000030348'],
  'TXN-000015': ['ARN74000000000000088600', 'ARN74000000000000075688'],
  'TXN-BAD-001': ['ARNBAD0000000000001'],
  'TXN-BAD-002': [],
  'TXN-BAD-003': ['ARNBAD0000000000002'],
};
const UNMATCHED_SETTLEMENTS = ['ARN74000000000000058801'];

function ledgerRecord(a, category) {
  return {
    internal_txn_id: a[0],
    merchant_id: a[1],
    merchant_ref: a[2],
    card_type: a[3],
    card_last4: a[4],
    gross_amount: a[5],
    currency: LEDGER_CCY[a[0]] || 'USD',
    type: a[6],
    captured_at: a[7] + 'T00:00:00Z',
    category,
  };
}
function settlementRecord(a, category) {
  return {
    network_ref: a[0],
    merchant_ref: a[1],
    merchant_id: a[2],
    card_type: a[3],
    card_last4: a[4],
    settled_amount: a[5],
    interchange_fee: a[6],
    processor_fee: a[7],
    currency: a[8],
    settlement_date: a[9],
    category,
  };
}

/** Build the three-map GET /reconciliations payload from the sample arrays. */
export function buildSamplePayload() {
  const ledgerByRef = {};
  SETTLE.forEach((s) => (ledgerByRef[s[0]] = s));
  const catByLedger = {};
  LEDGER.forEach((l) => (catByLedger[l[0]] = l[8]));

  // network_ref -> its linking ledger id (reverse of LINKS)
  const refToLedgerId = {};
  Object.entries(LINKS).forEach(([id, refs]) => refs.forEach((r) => (refToLedgerId[r] = id)));

  const intToStl = {};
  LEDGER.forEach((l) => {
    const refs = LINKS[l[0]] || [];
    intToStl[l[0]] = refs.length
      ? refs.map((r) => settlementRecord(ledgerByRef[r], catByLedger[l[0]]))
      : [null];
  });
  intToStl.null = UNMATCHED_SETTLEMENTS.map((r) =>
    settlementRecord(ledgerByRef[r], 'UNMATCHED_SETTLEMENT'),
  );

  const stlToInt = {};
  SETTLE.forEach((s) => {
    const ref = s[0];
    const lid = refToLedgerId[ref];
    if (lid) {
      const lrow = LEDGER.find((l) => l[0] === lid);
      stlToInt[ref] = [ledgerRecord(lrow, catByLedger[lid])];
    } else {
      stlToInt[ref] = [null]; // unmatched settlement — no ledger
    }
  });
  // ledger rows with no settlement live in the settlement map's "null" bucket
  stlToInt.null = LEDGER.filter((l) => (LINKS[l[0]] || []).length === 0).map((l) =>
    ledgerRecord(l, catByLedger[l[0]]),
  );

  return {
    internal_transaction_to_processor_settlements_map: intToStl,
    processor_settlement_to_internal_transactions_map: stlToInt,
    merchant_ref_to_transaction_keys_map: {},
  };
}
