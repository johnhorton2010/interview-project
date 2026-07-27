package com.platinumrelations.interview.payment_reconciliation.reconciliation.model;

public enum Category {
    IN_PROGRESS,
    QUARANTINE,
    AMOUNT_MISMATCH,
    FEE_DISCREPANCY,
    DUPLICATE,
    SPLIT,
    ORPHAN_REFUND,
    WIDE_WINDOW,
    UNMATCHED_INTERNAL,
    UNMATCHED_SETTLEMENT,
    CLEAN_MATCH
}
