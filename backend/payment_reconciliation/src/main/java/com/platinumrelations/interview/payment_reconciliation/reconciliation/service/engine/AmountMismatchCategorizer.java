package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.FeeCalculator;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * Detects a settled principal that cannot be explained even by the processor's own reported fees.
 *
 * <p>The comparison is deliberately made against the <em>reported</em> fees rather than the
 * scheduled ones, which makes this an internal consistency check: if the settled amount does not
 * equal gross minus the fees the processor itself claimed to deduct, the principal is wrong
 * whether or not those fees were correct.
 *
 * <p>That framing is what separates this from a fee discrepancy, where the arithmetic <em>is</em>
 * internally consistent but the fees disagree with the published schedule. Comparing against the
 * schedule here instead would conflate the two and lose the distinction between being shortchanged
 * on principal and being overcharged on fees.
 *
 * @author John
 */
@Service
class AmountMismatchCategorizer {

    /**
     * Creates the categorizer.
     *
     * @param feeCalculator derives the implied settlement and owns the tolerance band
     */
    AmountMismatchCategorizer(FeeCalculator feeCalculator){
        this.feeCalculator = feeCalculator;
    }

    /** Derives the implied settlement and owns the tolerance band. */
    private final FeeCalculator feeCalculator;

    /**
     * Tests whether the settled amount is inconsistent with the reported fees.
     *
     * <p>Derives {@code gross − reported_interchange − reported_processor_fee} and compares the
     * reported settled amount against it within tolerance, so sub-cent rounding divergence does
     * not register as a break.
     *
     * @param it the ledger side, supplying the gross amount
     * @param ps the settlement side, supplying the reported fees and the settled amount
     * @return {@code true} if the settled amount falls outside the tolerance band around the
     *         implied figure
     * @throws NullPointerException if either side is missing an amount or a fee
     */
    // principal off beyond rounding
    // settled_amount != gross − reported_interchange − reported_processor_fee
    boolean hasAmountMismatch(InternalTransaction it, ProcessorSettlement ps){
        BigDecimal calcSettlement = feeCalculator.computeExpectedSettlement(it.getGrossAmount(), ps.getInterchangeFee(), ps.getProcessorFee());
        return !feeCalculator.isWithinTolerance(ps.getSettledAmount(), calcSettlement);
    }
}
