package com.platinumrelations.interview.payment_reconciliation.processor.util;

import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;

import java.util.Comparator;

/**
 * Holder for the settlement ordering used to detect duplicate reports.
 *
 * <p>A holder rather than a {@code Comparator} implementation, so the ordering can be referenced
 * statically without an instance.
 *
 * @author John
 */
public class ProcessorSettlementComparator {

    /**
     * Orders settlements by every economically meaningful field, ignoring {@code networkRef} and
     * {@code category}.
     *
     * <p>The ordering itself carries no meaning; what matters is when it returns zero. Two
     * settlements that compare equal describe the same economic event reported twice under
     * different network references &mdash; exactly the definition of a duplicate. Excluding
     * {@code networkRef} is the entire point, since that field is guaranteed to differ between the
     * two reports; {@code category} is excluded because it is the reconciliation outcome being
     * derived, not an input to it.
     *
     * <p>Consistent with equals is deliberately <em>not</em> maintained.
     * {@link ProcessorSettlement} defines equality on {@code networkRef} alone, so two settlements
     * this comparator calls equal are unequal to {@code equals}. That inconsistency is what makes
     * the comparator useful in a {@link java.util.TreeSet}, whose membership then follows the
     * comparator rather than {@code equals} and so rejects the second report of a duplicated
     * event.
     *
     * <p>Every compared field must be non-{@code null}: the underlying
     * {@link Comparator#comparing(java.util.function.Function)} chain uses natural ordering and
     * throws {@link NullPointerException} otherwise. In practice this is safe because duplicate
     * detection runs over settlements that were matched by merchant reference and therefore have
     * that field populated; it is not safe over the settlements returned by a query that
     * deliberately selects rows with a missing merchant reference.
     *
     * <p>Immutable and stateless, so it is safe to share across threads.
     */
    public static final Comparator<ProcessorSettlement> compareWithoutNetworkRefAndCategory = Comparator
            .comparing(ProcessorSettlement::getMerchantRef)
            .thenComparing(ProcessorSettlement::getMerchantId)
            .thenComparing(ProcessorSettlement::getCardLast4)
            .thenComparing(ProcessorSettlement::getCardType)
            .thenComparing(ProcessorSettlement::getSettledAmount)
            .thenComparing(ProcessorSettlement::getInterchangeFee)
            .thenComparing(ProcessorSettlement::getProcessorFee)
            .thenComparing(ProcessorSettlement::getCurrency)
            .thenComparing(ProcessorSettlement::getSettlementDate);
}
