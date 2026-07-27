package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.springframework.stereotype.Service;

@Service
class OrphanRefundCategorizer {

    OrphanRefundCategorizer(ReconciliationRepository reconciliationRepository){
        this.reconciliationRepository = reconciliationRepository;
    }

    private final ReconciliationRepository reconciliationRepository;

    public int handleOrphanRefund(){
        return reconciliationRepository.createReconciledTransactionWithOrphanRefundFromLedger();
    }
}
