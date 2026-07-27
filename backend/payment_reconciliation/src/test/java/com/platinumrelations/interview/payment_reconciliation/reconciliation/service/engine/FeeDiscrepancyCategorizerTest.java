package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.core.model.CardType;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.Type;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.FeeCalculator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class FeeDiscrepancyCategorizerTest {

    @Mock
    FeeCalculator feeCalculator;
    @Mock
    AmountMismatchCategorizer amountMismatchCategorizer;

    @InjectMocks
    FeeDiscrepancyCategorizer feeDiscrepancyCategorizer;

    @Test
    void hasFeeDiscrepancy_false_whenHasAmountMismatch(){
        InternalTransaction it = InternalTransaction
                .builder()
                .internalTxnId("it1")
                .type(Type.SALE.name())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .build();

        when(amountMismatchCategorizer.hasAmountMismatch(any(), any())).thenReturn(Boolean.TRUE);

        assertFalse(feeDiscrepancyCategorizer.hasFeeDiscrepancy(it, ps));
    }

    @Test
    void hasFeeDiscrepancy_false_whenLedgerIsRefundType(){
        InternalTransaction it = InternalTransaction
                .builder()
                .internalTxnId("it1")
                .type(Type.REFUND.name())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .build();

        assertFalse(feeDiscrepancyCategorizer.hasFeeDiscrepancy(it, ps));
    }

    @Test
    void hasFeeDiscrepancy_true_whenInterchangeFeeMismatch(){
        InternalTransaction it = InternalTransaction
                .builder()
                .internalTxnId("it1")
                .type(Type.SALE.name())
                .cardType(CardType.VISA.name())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .interchangeFee(new BigDecimal("2.50"))
                .build();

        when(amountMismatchCategorizer.hasAmountMismatch(any(), any())).thenReturn(Boolean.FALSE);
        when(feeCalculator.computeInterchangeFee(anyString(), any())).thenReturn(new BigDecimal("1.50"));

        assertTrue(feeDiscrepancyCategorizer.hasFeeDiscrepancy(it, ps));
    }

    @Test
    void hasFeeDiscrepancy_true_whenInterchangeFeeMatchAndProcessorFeeMismatch(){
        InternalTransaction it = InternalTransaction
                .builder()
                .internalTxnId("it1")
                .type(Type.SALE.name())
                .cardType(CardType.VISA.name())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .interchangeFee(new BigDecimal("1.50"))
                .processorFee(new BigDecimal("0.65"))
                .build();

        when(amountMismatchCategorizer.hasAmountMismatch(any(), any())).thenReturn(Boolean.FALSE);
        when(feeCalculator.computeInterchangeFee(anyString(), any())).thenReturn(new BigDecimal("1.50"));
        when(feeCalculator.computeProcessorFee(any())).thenReturn(new BigDecimal("0.55"));

        assertTrue(feeDiscrepancyCategorizer.hasFeeDiscrepancy(it, ps));
    }

    @Test
    void hasFeeDiscrepancy_false_whenInterchangeFeeMatchAndProcessorMismatch(){
        InternalTransaction it = InternalTransaction
                .builder()
                .internalTxnId("it1")
                .type(Type.SALE.name())
                .cardType(CardType.VISA.name())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .interchangeFee(new BigDecimal("1.50"))
                .processorFee(new BigDecimal("0.55"))
                .build();

        when(amountMismatchCategorizer.hasAmountMismatch(any(), any())).thenReturn(Boolean.FALSE);
        when(feeCalculator.computeInterchangeFee(anyString(), any())).thenReturn(new BigDecimal("1.50"));
        when(feeCalculator.computeProcessorFee(any())).thenReturn(new BigDecimal("0.55"));

        assertFalse(feeDiscrepancyCategorizer.hasFeeDiscrepancy(it, ps));
    }
}
