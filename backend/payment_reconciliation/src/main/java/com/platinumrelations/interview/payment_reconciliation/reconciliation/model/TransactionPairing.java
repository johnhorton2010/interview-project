package com.platinumrelations.interview.payment_reconciliation.reconciliation.model;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import lombok.Data;

import java.util.HashSet;
import java.util.Set;

@Data
public class TransactionPairing {
    private Set<InternalTransaction> internalTransactions = new HashSet<>();
    private Set<ProcessorSettlement> processorSettlements = new HashSet<>();
}
