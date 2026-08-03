package com.platinumrelations.interview.payment_reconciliation.ledger.model;

/**
 * Direction of a ledger transaction.
 *
 * <p>Determines the expected sign of the corresponding settlement, and matching SQL relies on
 * that: a {@link #SALE} may only pair with a positive settled amount and a {@link #REFUND} only
 * with a negative one. Without that guard a sale and a refund sharing a merchant reference would
 * match each other.
 *
 * @author John
 */
public enum Type {
    /** Money captured from the cardholder; settles as a positive amount. */
    SALE,
    /** Money returned to the cardholder; settles as a negative amount. */
    REFUND
}
