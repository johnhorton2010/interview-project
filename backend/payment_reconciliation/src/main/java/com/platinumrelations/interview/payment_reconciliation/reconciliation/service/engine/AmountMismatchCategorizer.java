package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.FeeCalculator;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
class AmountMismatchCategorizer {

    AmountMismatchCategorizer(FeeCalculator feeCalculator){
        this.feeCalculator = feeCalculator;
    }

    private final FeeCalculator feeCalculator;

    // principal off beyond rounding
    // settled_amount != gross − reported_interchange − reported_processor_fee
    boolean hasAmountMismatch(InternalTransaction it, ProcessorSettlement ps){
        BigDecimal calcSettlement = feeCalculator.computeExpectedSettlement(it.grossAmount(), ps.interchangeFee(), ps.processorFee());
        return !feeCalculator.isWithinTolerance(ps.settledAmount(), calcSettlement);
    }
}
