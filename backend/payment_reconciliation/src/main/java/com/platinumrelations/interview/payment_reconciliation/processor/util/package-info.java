/**
 * Comparison helpers for settlements.
 *
 * <p>Holds the ordering that treats two settlements as the same economic event when every field
 * except the network reference agrees. That ordering is the mechanism behind duplicate detection:
 * a duplicated settlement is by definition the same event reported twice under different network
 * references, so the comparator must ignore exactly the field that identifies a settlement.
 *
 * <p>It is intentionally inconsistent with {@code ProcessorSettlement}'s {@code equals}, which is
 * defined on the network reference alone.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.processor.util;
