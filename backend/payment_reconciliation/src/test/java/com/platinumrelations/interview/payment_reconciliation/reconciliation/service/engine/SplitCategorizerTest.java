package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.core.model.CardType;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.FeeCalculator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class SplitCategorizerTest {
    @Mock
    DuplicateCategorizer duplicateCategorizer;
    @Mock
    FeeCalculator feeCalculator;

    @InjectMocks
    SplitCategorizer splitCategorizer;

    @Captor
    ArgumentCaptor<BigDecimal> potentialSplitTotalCapture;

    @Test
    void findSplitProcessorSettlements_matchesAsSplit_whenInTolerance(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .cardType(CardType.VISA.name())
                .grossAmount(new BigDecimal("124.89"))
                .build();
        ProcessorSettlement ps1 = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settledAmount(new BigDecimal("20.00"))
                .build();
        ProcessorSettlement ps2 = ProcessorSettlement
                .builder()
                .networkRef("ps2")
                .settledAmount(new BigDecimal("10.00"))
                .build();
        ProcessorSettlement ps3 = ProcessorSettlement
                .builder()
                .networkRef("ps3")
                .settledAmount(new BigDecimal("70.00"))
                .build();
        Set<ProcessorSettlement> psSet = Set.of(ps1, ps2, ps3);

        when(duplicateCategorizer.findDuplicateProcessorSettlements(any())).thenReturn(Set.of());
        when(feeCalculator.computeExpectedSettlement(anyString(), any())).thenReturn(new BigDecimal("100.00"));
        when(feeCalculator.isWithinTolerance(any(), any())).thenReturn(Boolean.TRUE);

        Set<ProcessorSettlement> rtnSet = splitCategorizer.findSplitProcessorSettlements(it, psSet);

        verify(feeCalculator).isWithinTolerance(potentialSplitTotalCapture.capture(), any());

        BigDecimal potentialSplitTotal = potentialSplitTotalCapture.getValue();
        BigDecimal target = new BigDecimal("100.0");

        assertEquals(0, potentialSplitTotal.compareTo(target));
        assertEquals(3, rtnSet.size());
    }

    @Test
    void findSplitProcessorSettlements_noneAsSplit_whenOutOfTolerance(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .cardType(CardType.VISA.name())
                .grossAmount(new BigDecimal("124.89"))
                .build();
        ProcessorSettlement ps1 = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settledAmount(new BigDecimal("20.00"))
                .build();
        ProcessorSettlement ps2 = ProcessorSettlement
                .builder()
                .networkRef("ps2")
                .settledAmount(new BigDecimal("10.00"))
                .build();
        ProcessorSettlement ps3 = ProcessorSettlement
                .builder()
                .networkRef("ps3")
                .settledAmount(new BigDecimal("70.00"))
                .build();
        Set<ProcessorSettlement> psSet = Set.of(ps1, ps2, ps3);

        when(duplicateCategorizer.findDuplicateProcessorSettlements(any())).thenReturn(Set.of());
        when(feeCalculator.computeExpectedSettlement(anyString(), any())).thenReturn(new BigDecimal("100.00"));
        when(feeCalculator.isWithinTolerance(any(), any())).thenReturn(Boolean.FALSE);

        Set<ProcessorSettlement> rtnSet = splitCategorizer.findSplitProcessorSettlements(it, psSet);

        verify(feeCalculator).isWithinTolerance(potentialSplitTotalCapture.capture(), any());

        BigDecimal potentialSplitTotal = potentialSplitTotalCapture.getValue();
        BigDecimal target = new BigDecimal("100.0");

        assertEquals(0, potentialSplitTotal.compareTo(target));
        assertEquals(0, rtnSet.size());
    }

    @Test
    void findSplitProcessorSettlements_matchesAsSplit_whenInToleranceAndDuplicate(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .cardType(CardType.VISA.name())
                .grossAmount(new BigDecimal("124.89"))
                .build();
        ProcessorSettlement ps1 = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settledAmount(new BigDecimal("20.00"))
                .build();
        ProcessorSettlement ps2 = ProcessorSettlement
                .builder()
                .networkRef("ps2")
                .settledAmount(new BigDecimal("10.00"))
                .build();
        ProcessorSettlement ps3 = ProcessorSettlement
                .builder()
                .networkRef("ps3")
                .settledAmount(new BigDecimal("70.00"))
                .build();
        ProcessorSettlement ps4 = ProcessorSettlement
                .builder()
                .networkRef("ps4")
                .settledAmount(new BigDecimal("90.00"))
                .build();
        ProcessorSettlement ps5 = ProcessorSettlement
                .builder()
                .networkRef("ps5")
                .settledAmount(new BigDecimal("90.00"))
                .build();
        Set<ProcessorSettlement> psSet = Set.of(ps1, ps2, ps3);

        when(duplicateCategorizer.findDuplicateProcessorSettlements(any())).thenReturn(Set.of(ps4,ps5));
        when(feeCalculator.computeExpectedSettlement(anyString(), any())).thenReturn(new BigDecimal("100.00"));
        when(feeCalculator.isWithinTolerance(any(), any())).thenReturn(Boolean.TRUE);

        Set<ProcessorSettlement> rtnSet = splitCategorizer.findSplitProcessorSettlements(it, psSet);

        verify(feeCalculator).isWithinTolerance(potentialSplitTotalCapture.capture(), any());

        BigDecimal potentialSplitTotal = potentialSplitTotalCapture.getValue();
        BigDecimal target = new BigDecimal("100.0");

        assertEquals(0, potentialSplitTotal.compareTo(target));
        assertEquals(3, rtnSet.size());
    }

    @Test
    void findSplitProcessorSettlements_noneAsSplit_whenEmptyProcessSettlement(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .cardType(CardType.VISA.name())
                .grossAmount(new BigDecimal("124.89"))
                .build();
        Set<ProcessorSettlement> psSet = Set.of();

        when(duplicateCategorizer.findDuplicateProcessorSettlements(any())).thenReturn(Set.of());

        Set<ProcessorSettlement> rtnSet = splitCategorizer.findSplitProcessorSettlements(it, psSet);

        assertEquals(0, rtnSet.size());
    }
}
