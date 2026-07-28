package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.Type;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.FeeCalculator;
import org.springframework.stereotype.Service;

@Service
class FeeDiscrepancyCategorizer {
    FeeDiscrepancyCategorizer(FeeCalculator feeCalculator, AmountMismatchCategorizer amountMismatchCategorizer){
        this.feeCalculator = feeCalculator;
        this.amountMismatchCategorizer = amountMismatchCategorizer;
    }

    private final FeeCalculator feeCalculator;
    private final AmountMismatchCategorizer amountMismatchCategorizer;

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
