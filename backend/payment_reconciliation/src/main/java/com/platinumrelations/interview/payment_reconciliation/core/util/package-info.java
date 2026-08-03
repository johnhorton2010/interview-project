/**
 * Serialization helpers shared by more than one module.
 *
 * <p>Currently the lenient {@code BigDecimal} deserializer applied to inbound amount columns.
 * Helpers live here rather than beside a single model because both the ledger and the processor
 * feed arrive as third-party files with the same tolerance for malformed cells.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.core.util;
