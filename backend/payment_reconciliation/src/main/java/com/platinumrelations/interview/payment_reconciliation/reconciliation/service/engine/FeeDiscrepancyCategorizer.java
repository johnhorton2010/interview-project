package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.Type;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.FeeCalculator;
import org.springframework.stereotype.Service;

/**
 * Detects reported fees that deviate from the published schedule, on an otherwise sound
 * settlement.
 *
 * <p>The overcharge case, and the one a naive check misses entirely: the settled amount reconciles
 * perfectly against the fees the processor reported, so any test comparing only those two figures
 * passes. Catching it requires comparing the reported fees against {@code fee_schedule.json}
 * itself.
 *
 * <p>Depends on {@link AmountMismatchCategorizer} in order to exclude its cases rather than to
 * find its own. That dependency encodes the precedence between the two findings: fees are only
 * worth questioning once the principal is known to be trustworthy.
 *
 * @author John
 */
@Service
class FeeDiscrepancyCategorizer {
    /**
     * Creates the categorizer.
     *
     * @param feeCalculator             recomputes each fee from the published schedule
     * @param amountMismatchCategorizer used to exclude transactions whose principal is already wrong
     */
    FeeDiscrepancyCategorizer(FeeCalculator feeCalculator, AmountMismatchCategorizer amountMismatchCategorizer){
        this.feeCalculator = feeCalculator;
        this.amountMismatchCategorizer = amountMismatchCategorizer;
    }

    /** Recomputes each fee from the published schedule. */
    private final FeeCalculator feeCalculator;
    /** Used to exclude transactions whose principal is already wrong. */
    private final AmountMismatchCategorizer amountMismatchCategorizer;

    /**
     * Tests whether the reported fees deviate from the published schedule.
     *
     * <p>Two cases are excluded before any fee is compared. Refunds are exempt because fees are
     * not returned when money is refunded, so a refund has no scheduled fee to deviate from and
     * comparing one would flag every refund. Transactions already failing the amount check are
     * exempt because their principal is wrong, which is the more fundamental finding and the one
     * that should be reported.
     *
     * <p>The interchange fee is checked first and short-circuits; the processor fee decides
     * otherwise. Both comparisons are <strong>exact</strong> rather than tolerance-based, unlike
     * every amount comparison in the pipeline: a fee is computed from the schedule by a defined
     * formula and rounded to the cent, so any difference at all is a genuine deviation rather than
     * reconstruction noise.
     *
     * @param it the ledger side, supplying the transaction type, card network, and gross amount
     * @param ps the settlement side, supplying the reported fees
     * @return {@code true} if either reported fee differs from the scheduled figure on a sale
     *         whose principal is sound; {@code false} for refunds and for amount mismatches
     * @throws IllegalArgumentException if the card type does not name a known network
     * @throws NullPointerException     if the transaction type, an amount, or a fee is {@code null}
     */
    // settled_amount = gross − reported_interchange − reported_processor_fee
    // reported_interchange and reported process fee do not match fee schedule
    boolean hasFeeDiscrepancy(InternalTransaction it, ProcessorSettlement ps){
        if(it.getType().equals(Type.REFUND.name())) {
            return Boolean.FALSE;
        }

        boolean hasAmountMismatch = amountMismatchCategorizer.hasAmountMismatch(it, ps);
        if(hasAmountMismatch){
            return Boolean.FALSE;
        }

        boolean hasInterchangeFeeMismatch = (feeCalculator
                .computeInterchangeFee(it.getCardType(), it.getGrossAmount())
                .compareTo(ps.getInterchangeFee())) != 0;

        if(hasInterchangeFeeMismatch){
            return Boolean.TRUE;
        }

        // is checking whether there is a processor fee mismatch and returns the result as this is the final condition
        return (feeCalculator
                .computeProcessorFee(it.getGrossAmount())
                .compareTo(ps.getProcessorFee())) != 0;
    }
}
