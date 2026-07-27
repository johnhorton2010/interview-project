package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
public class QuarantineCategorizerTest {

    @Mock
    ReconciliationRepository reconciliationRepository;

    @InjectMocks
    QuarantineCategorizer quarantineCategorizer;

    @Test
    void handleQuarantineBadTransactionsInLedger_isCalledOnce_whenRepositoryIsInvoked(){
        quarantineCategorizer.handleQuarantineBadTransactionsInLedger();
        verify(reconciliationRepository).createReconciledTransactionWithQuarantineFromLedger();
    }

    @Test
    void handleQuarantineBadTransactionsInSettlement_isCalledOnce_whenRepositoryIsInvoked(){
        quarantineCategorizer.handleQuarantineBadTransactionsInSettlement();
        verify(reconciliationRepository).createReconciledTransactionWithQuarantineFromProcessorSettlement();
    }
}
