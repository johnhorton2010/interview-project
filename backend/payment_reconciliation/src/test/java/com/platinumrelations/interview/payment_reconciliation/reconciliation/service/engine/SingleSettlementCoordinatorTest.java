package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.exception.UnexpectedSettlementsException;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.Category;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.ReconciledTransaction;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class SingleSettlementCoordinatorTest {

    @Mock
    ReconciliationRepository reconciliationRepository;
    @Mock
    WideWindowCategorizer wideWindowCategorizer;
    @Mock
    AmountMismatchCategorizer amountMismatchCategorizer;
    @Mock
    FeeDiscrepancyCategorizer feeDiscrepancyCategorizer;

    @InjectMocks
    SingleSettlementCoordinator singleSettlementCoordinator;

    @Captor
    ArgumentCaptor<List<ReconciledTransaction>> rtListCaptor;

    @Test
    void handleMatchesWithSingleSettlement_matchesAsAmountMismatch_whenAmountMismatchPresent() {
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it = InternalTransaction
                .builder()
                .internalTxnId("it1")
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .build();
        itToPsMap.put(it, new HashSet<>(List.of(ps)));

        when(reconciliationRepository.findMatchedTransactionsInProgress()).thenReturn(transactionMapping);
        when(amountMismatchCategorizer.hasAmountMismatch(any(), any())).thenReturn(Boolean.TRUE);

        singleSettlementCoordinator.handleMatchesWithSingleSettlement();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(1, capturedResult.size());
        assertEquals(1, capturedResult
                .stream()
                .filter(reconciledTransaction -> reconciledTransaction
                        .category()
                        .equals(Category.AMOUNT_MISMATCH.name()))
                        .count());
    }

    @Test
    void handleMatchesWithSingleSettlement_matchesAsFeeDiscrepancy_whenFeeDiscrepancyPresent() {
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it = InternalTransaction
                .builder()
                .internalTxnId("it1")
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .build();
        itToPsMap.put(it, new HashSet<>(List.of(ps)));

        when(reconciliationRepository.findMatchedTransactionsInProgress()).thenReturn(transactionMapping);
        when(amountMismatchCategorizer.hasAmountMismatch(any(), any())).thenReturn(Boolean.FALSE);
        when(feeDiscrepancyCategorizer.hasFeeDiscrepancy(any(), any())).thenReturn(Boolean.TRUE);

        singleSettlementCoordinator.handleMatchesWithSingleSettlement();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(1, capturedResult.size());
        assertEquals(1, capturedResult
                .stream()
                .filter(reconciledTransaction -> reconciledTransaction
                        .category()
                        .equals(Category.FEE_DISCREPANCY.name()))
                        .count());
    }

    @Test
    void handleMatchesWithSingleSettlement_matchesAsWideWindow_whenWideWindowPresent() {
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it = InternalTransaction
                .builder()
                .internalTxnId("it1")
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .build();
        itToPsMap.put(it, new HashSet<>(List.of(ps)));

        when(reconciliationRepository.findMatchedTransactionsInProgress()).thenReturn(transactionMapping);
        when(amountMismatchCategorizer.hasAmountMismatch(any(), any())).thenReturn(Boolean.FALSE);
        when(feeDiscrepancyCategorizer.hasFeeDiscrepancy(any(), any())).thenReturn(Boolean.FALSE);
        when(wideWindowCategorizer.hasWideWindow(any(), any())).thenReturn(Boolean.TRUE);


        singleSettlementCoordinator.handleMatchesWithSingleSettlement();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(1, capturedResult.size());
        assertEquals(1, capturedResult
                .stream()
                .filter(reconciledTransaction -> reconciledTransaction
                        .category()
                        .equals(Category.WIDE_WINDOW.name()))
                        .count());
    }

    @Test
    void handleMatchesWithSingleSettlement_matchesAsCleanMatch_whenNoPreviouslyCheckedCategoriesMatch() {
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it = InternalTransaction
                .builder()
                .internalTxnId("it1")
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .build();
        itToPsMap.put(it, new HashSet<>(List.of(ps)));

        when(reconciliationRepository.findMatchedTransactionsInProgress()).thenReturn(transactionMapping);
        when(amountMismatchCategorizer.hasAmountMismatch(any(), any())).thenReturn(Boolean.FALSE);
        when(feeDiscrepancyCategorizer.hasFeeDiscrepancy(any(), any())).thenReturn(Boolean.FALSE);
        when(wideWindowCategorizer.hasWideWindow(any(), any())).thenReturn(Boolean.FALSE);

        singleSettlementCoordinator.handleMatchesWithSingleSettlement();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(1, capturedResult.size());
        assertEquals(1, capturedResult
                .stream()
                .filter(reconciledTransaction -> reconciledTransaction
                        .category()
                        .equals(Category.CLEAN_MATCH.name()))
                        .count());
    }

    @Test
    void handleMatchesWithSingleSettlement_throwsException_whenMultipleProcessorSettlementsAttached() {
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it = InternalTransaction
                .builder()
                .internalTxnId("it1")
                .build();
        ProcessorSettlement ps1 = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .build();
        ProcessorSettlement ps2 = ProcessorSettlement
                .builder()
                .networkRef("ps2")
                .build();
        itToPsMap.put(it, new HashSet<>(List.of(ps1, ps2)));

        when(reconciliationRepository.findMatchedTransactionsInProgress()).thenReturn(transactionMapping);

        assertThrows(UnexpectedSettlementsException.class, () -> singleSettlementCoordinator.handleMatchesWithSingleSettlement());
    }
}