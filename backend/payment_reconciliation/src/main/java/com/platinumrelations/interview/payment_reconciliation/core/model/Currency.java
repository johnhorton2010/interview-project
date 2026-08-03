package com.platinumrelations.interview.payment_reconciliation.core.model;

/**
 * Settlement currencies the reconciliation pipeline accepts.
 *
 * <p>Amounts are never converted between currencies, so a ledger transaction and a processor
 * settlement are only comparable when both were captured in the same currency.
 *
 * @author John
 */
public enum Currency {
    USD,
    EUR
}
