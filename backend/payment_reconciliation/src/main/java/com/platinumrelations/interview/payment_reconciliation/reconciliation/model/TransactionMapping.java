package com.platinumrelations.interview.payment_reconciliation.reconciliation.model;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.util.InternalTransactionKeyDeserializer;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.util.ProcessorSettlementKeyDeserializer;
import tools.jackson.databind.annotation.JsonSerialize;

import java.util.Map;
import java.util.Set;

public record TransactionMapping(
        @JsonSerialize(keyUsing = InternalTransactionKeyDeserializer.class)
        Map<InternalTransaction, Set<ProcessorSettlement>> internalTransactionToProcessorSettlementsMap,
        @JsonSerialize(keyUsing = ProcessorSettlementKeyDeserializer.class)
        Map<ProcessorSettlement, Set<InternalTransaction>> processorSettlementToInternalTransactionsMap,
        Map<String, TransactionPairing> merchantRefToTransactionKeysMap) {

}