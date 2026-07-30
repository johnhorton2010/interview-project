package com.platinumrelations.interview.payment_reconciliation.reconciliation.service;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.springframework.stereotype.Service;

@Service
public class ReconciliationService {

    public ReconciliationService(ReconciliationRepository reconciliationRepository){
        this.reconciliationRepository = reconciliationRepository;
    }

    private final ReconciliationRepository reconciliationRepository;

    public TransactionMapping retrieveAllReconciledTransactions(){
        return reconciliationRepository.findAllReconciledTransactions();
    }

    public int removeAllExistingReconciledTransactions(){
        return reconciliationRepository.deleteAll();
    }
}
