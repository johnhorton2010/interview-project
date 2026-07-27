package com.platinumrelations.interview.payment_reconciliation.reconciliation.model;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.util.InternalTransactionSetToKeySerializer;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.util.ProcessorSettlementSetToKeySerializer;
import lombok.Data;
import tools.jackson.databind.annotation.JsonSerialize;

import java.util.HashSet;
import java.util.Set;

@Data
public class TransactionPairing {
    @JsonSerialize(using = InternalTransactionSetToKeySerializer.class)
    private Set<InternalTransaction> internalTransactions = new HashSet<>();
    @JsonSerialize(using = ProcessorSettlementSetToKeySerializer.class)
    private Set<ProcessorSettlement> processorSettlements = new HashSet<>();
}
