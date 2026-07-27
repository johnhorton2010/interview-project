package com.platinumrelations.interview.payment_reconciliation.processor.util;

import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;

import java.util.Comparator;

public class ProcessorSettlementComparator {

    public static final Comparator<ProcessorSettlement> compareWithoutNetworkRef = Comparator
            .comparing(ProcessorSettlement::merchantRef)
            .thenComparing(ProcessorSettlement::merchantId)
            .thenComparing(ProcessorSettlement::cardLast4)
            .thenComparing(ProcessorSettlement::cardType)
            .thenComparing(ProcessorSettlement::settledAmount)
            .thenComparing(ProcessorSettlement::interchangeFee)
            .thenComparing(ProcessorSettlement::processorFee)
            .thenComparing(ProcessorSettlement::currency)
            .thenComparing(ProcessorSettlement::settlementDate);
}
