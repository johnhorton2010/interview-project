package com.platinumrelations.interview.payment_reconciliation.reconciliation.model;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;

import java.util.Map;
import java.util.Set;

public record TransactionMapping(
        Map<InternalTransaction, Set<ProcessorSettlement>> internalTransactionToProcessorSettlementsMap,
        Map<ProcessorSettlement, Set<InternalTransaction>> processorSettlementToIternalTransactionsMap,
        Map<String, TransactionPairing> merchantRefToTransactionKeysMap) {

}