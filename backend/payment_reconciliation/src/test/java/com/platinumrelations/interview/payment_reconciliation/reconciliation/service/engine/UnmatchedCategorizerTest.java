package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
public class UnmatchedCategorizerTest {

    @Mock
    ReconciliationRepository reconciliationRepository;

    @InjectMocks
    UnmatchedCategorizer unmatchedCategorizer;

    @Test
    void handleUnmatchedInternalInLedger_isCalledOnce_whenRepositoryIsInvoked(){
        unmatchedCategorizer.handleUnmatchedInternalInLedger();
        verify(reconciliationRepository).createReconciledTransactionWithUnmatchedInternalFromLedger();
    }

    @Test
    void handleUnmatchedInProcessorSettlement_isCalledOnce_whenRepositoryIsInvoked(){
        unmatchedCategorizer.handleUnmatchedInProcessorSettlement();
        verify(reconciliationRepository).createReconciledTransactionWithUnmatchedSettlementFromProcessorSettlement();
    }
}
