package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.springframework.stereotype.Service;

@Service
class UnmatchedCategorizer {

    UnmatchedCategorizer(ReconciliationRepository reconciliationRepository){
        this.reconciliationRepository = reconciliationRepository;
    }

    private final ReconciliationRepository reconciliationRepository;

    // existing ledger without corresponding settlement transaction
    public int handleUnmatchedInternalInLedger(){
        return reconciliationRepository.createReconciledTransactionWithUnmatchedInternalFromLedger();
    }

    // existing processor settlement without corresponding ledger transaction
    public int handleUnmatchedInProcessorSettlement(){
        return reconciliationRepository.createReconciledTransactionWithUnmatchedSettlementFromProcessorSettlement();
    }
}
