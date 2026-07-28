package com.platinumrelations.interview.payment_reconciliation.processor.util;

import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;

import java.util.Comparator;

public class ProcessorSettlementComparator {

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
