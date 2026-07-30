package com.platinumrelations.interview.payment_reconciliation.ledger.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@Transactional
public class LedgerServiceWithDatabaseTest {
    @Autowired
    LedgerService ledgerService;

    @Test
    void removeAllExistingInternalTransactions_success_happyPath(){
        assertEquals(18, ledgerService.removeAllExistingInternalTransactions());
    }
}
