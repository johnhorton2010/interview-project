package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.springframework.stereotype.Service;

@Service
class QuarantineCategorizer {

    private QuarantineCategorizer(ReconciliationRepository reconciliationRepository){
        this.reconciliationRepository = reconciliationRepository;
    }

    private final ReconciliationRepository reconciliationRepository;

    public int handleQuarantineBadTransactionsInLedger(){
        return reconciliationRepository.createReconciledTransactionWithQuarantineFromLedger();
    }

    //Look for Bad Settlement
    public int handleQuarantineBadTransactionsInSettlement(){
        return reconciliationRepository.createReconciledTransactionWithQuarantineFromProcessorSettlement();
    }
}
