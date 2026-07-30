package com.platinumrelations.interview.payment_reconciliation.reconciliation.service;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine.ReconciliationEngine;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@Transactional
public class ReconciliationServiceWithDatabaseTest {

    @Autowired
    ReconciliationService reconciliationService;

    @Autowired
    ReconciliationEngine reconciliationEngine;

    @Test
    void removeAllExistingReconciledTransactions_success_happyPath(){
        reconciliationEngine.reconcile();
        assertEquals(23, reconciliationService.removeAllExistingReconciledTransactions());
    }
}
