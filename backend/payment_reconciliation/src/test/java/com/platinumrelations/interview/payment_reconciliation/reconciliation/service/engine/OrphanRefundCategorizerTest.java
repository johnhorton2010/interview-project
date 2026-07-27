package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
public class OrphanRefundCategorizerTest {

    @Mock
    ReconciliationRepository reconciliationRepository;

    @InjectMocks
    OrphanRefundCategorizer orphanRefundCategorizer;

    @Test
    void handleOrphanRefund_isCalledOnce_whenRepositoryIsInvoked(){
        orphanRefundCategorizer.handleOrphanRefund();
        verify(reconciliationRepository).createReconciledTransactionWithOrphanRefundFromLedger();
    }
}
