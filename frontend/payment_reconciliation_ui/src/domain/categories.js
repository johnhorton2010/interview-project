// Category metadata: the single place category strings, severity and analyst-facing
// copy live (PRD §8). Lifted from the design component's CATS map so labels/severity
// match the prototype exactly. No component hard-codes a category string.

export const CATS = {
  CLEAN_MATCH: {
    label: 'Clean match',
    sev: 'none',
    explain: 'Ledger and settlement agree within tolerance. No action.',
  },
  AMOUNT_MISMATCH: {
    label: 'Amount mismatch',
    sev: 'high',
    explain:
      'Settled amount differs from the ledger amount net of fees by more than tolerance. Check for a partial capture or a post-authorisation adjustment.',
  },
  FEE_DISCREPANCY: {
    label: 'Fee discrepancy',
    sev: 'medium',
    explain:
      'The amounts reconcile but the fees charged differ from what was expected. Check the pricing schedule for this merchant and card type.',
  },
  DUPLICATE: {
    label: 'Duplicate settlement',
    sev: 'high',
    explain:
      'The processor settled the same ledger transaction more than once. Expect a clawback; confirm with the processor before crediting the merchant.',
  },
  SPLIT: {
    label: 'Split settlement',
    sev: 'low',
    explain:
      'One ledger transaction was settled across multiple payouts. Usually benign — a zero-impact break still warrants confirming the parts sum to the whole.',
  },
  ORPHAN_REFUND: {
    label: 'Orphan refund',
    sev: 'medium',
    explain:
      'A refund settled with no matching original sale in the ledger window. Check earlier periods.',
  },
  WIDE_WINDOW: {
    label: 'Wide settlement window',
    sev: 'low',
    explain:
      'Matched, but settled unusually long after capture. Timing only; typically no financial impact.',
  },
  UNMATCHED_INTERNAL: {
    label: 'Unmatched ledger transaction',
    sev: 'high',
    explain: 'We recorded a sale the processor never settled. Money we expected and did not receive.',
  },
  UNMATCHED_SETTLEMENT: {
    label: 'Unmatched settlement',
    sev: 'high',
    explain: 'The processor settled something absent from our ledger. Money we received and cannot attribute.',
  },
  QUARANTINE: {
    label: 'Quarantined',
    sev: 'excluded',
    explain:
      'Record failed validation and is excluded from every figure on this report. Fix at source and re-import.',
  },
};

/**
 * Resolve category metadata. Unknown categories (e.g. a future backend value such
 * as IN_PROGRESS) are retained with a neutral badge and the raw string as the label,
 * per PRD §6.4 — forward-compatible rather than throwing.
 * @param {string} cat
 */
export function getCategory(cat) {
  const known = CATS[cat];
  if (known) return { ...known, key: cat, known: true };
  return {
    key: cat,
    label: cat || '(unknown)',
    sev: 'low',
    explain: 'Category reported by the backend that this client does not recognise. Shown as-is.',
    known: false,
  };
}

/** A break is any row whose category is not a clean match (PRD FR-7.1). */
export function isBreakCategory(cat) {
  return cat !== 'CLEAN_MATCH' && cat !== 'QUARANTINE';
}

export const QUARANTINE = 'QUARANTINE';
export const CLEAN_MATCH = 'CLEAN_MATCH';
