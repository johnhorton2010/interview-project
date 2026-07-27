package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.FeeCalculator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class AmountMismatchCategorizerTest {

    @Mock
    private FeeCalculator feeCalculator;

    @InjectMocks
    private AmountMismatchCategorizer amountMismatchCategorizer;

    @Test
    void hasAmountMismatch_false_inTolerance(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .build();

        when(feeCalculator.isWithinTolerance(any(), any())).thenReturn(Boolean.TRUE);
        assertFalse(amountMismatchCategorizer.hasAmountMismatch(it, ps));
    }

    @Test
    void hasAmountMismatch_true_outOfTolerance(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .build();

        when(feeCalculator.isWithinTolerance(any(), any())).thenReturn(Boolean.FALSE);
        assertTrue(amountMismatchCategorizer.hasAmountMismatch(it, ps));
    }
}
