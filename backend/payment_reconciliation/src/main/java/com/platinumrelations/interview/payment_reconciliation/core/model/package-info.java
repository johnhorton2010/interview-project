/**
 * Value types shared across the ledger, processor, and reconciliation modules.
 *
 * <p>Everything here is immutable and free of business logic, which is what makes it safe for all
 * three modules to depend on: placing {@code CardType} or {@code Fee} inside any one module would
 * force the others to depend on it.
 *
 * <p>Monetary values are always {@link java.math.BigDecimal}. Binary floating point is never used
 * for amounts, since the reconciliation tolerance is measured in fractions of a cent and would be
 * meaningless against representation error.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.core.model;
