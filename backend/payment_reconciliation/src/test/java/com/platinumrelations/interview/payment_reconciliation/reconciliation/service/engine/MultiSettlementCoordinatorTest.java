package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.Category;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.ReconciledTransaction;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class MultiSettlementCoordinatorTest {

    @Mock
    ReconciliationRepository reconciliationRepository;
    @Mock
    DuplicateCategorizer duplicateCategorizer;
    @Mock
    SplitCategorizer splitCategorizer;

    @Captor
    ArgumentCaptor<List<ReconciledTransaction>> rtListCaptor;

    @InjectMocks
    MultiSettlementCoordinator multiSettlementCoordinator;

    @Test
    void handleMatchesWithMultipleSettlements_matchesAsDuplicate_whenDuplicatesPresent(){
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it =InternalTransaction
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
        Set<ProcessorSettlement> psSet = Set.of(ps1, ps2);
        itToPsMap.put(it, new HashSet<>(psSet));

        when(reconciliationRepository.findLedgerTransactionsWithMultipleSettlements()).thenReturn(transactionMapping);
        when(duplicateCategorizer.findDuplicateProcessorSettlements(any())).thenReturn(psSet);

        multiSettlementCoordinator.handleMatchesWithMultipleSettlements();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(2, capturedResult.size());
        assertEquals(2,  capturedResult.stream().filter(recon -> recon.category().equals(Category.DUPLICATE.name())).count());
    }

    @Test
    void handleMatchesWithMultipleSettlements_matchesAsSplit_whenSplitsPresent(){
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it =InternalTransaction
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
        Set<ProcessorSettlement> psSet = Set.of(ps1, ps2);
        itToPsMap.put(it, new HashSet<>(psSet));

        when(reconciliationRepository.findLedgerTransactionsWithMultipleSettlements()).thenReturn(transactionMapping);
        when(splitCategorizer.findSplitProcessorSettlements(it, psSet)).thenReturn(psSet);

        multiSettlementCoordinator.handleMatchesWithMultipleSettlements();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(2, capturedResult.size());
        assertEquals(2,  capturedResult.stream().filter(recon -> recon.category().equals(Category.SPLIT.name())).count());
    }

    @Test
    void handleMatchesWithMultipleSettlements_matchesAsSplitAndDuplicate_whenSplitsAndDuplicatesPresent(){
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it =InternalTransaction
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
        Set<ProcessorSettlement> psSet = Set.of(ps1, ps2);
        itToPsMap.put(it, new HashSet<>(psSet));

        when(reconciliationRepository.findLedgerTransactionsWithMultipleSettlements()).thenReturn(transactionMapping);
        when(duplicateCategorizer.findDuplicateProcessorSettlements(any())).thenReturn(psSet);
        when(splitCategorizer.findSplitProcessorSettlements(it, psSet)).thenReturn(psSet);

        multiSettlementCoordinator.handleMatchesWithMultipleSettlements();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(4, capturedResult.size());
        assertEquals(2,  capturedResult.stream().filter(recon -> recon.category().equals(Category.DUPLICATE.name())).count());
        assertEquals(2,  capturedResult.stream().filter(recon -> recon.category().equals(Category.SPLIT.name())).count());
    }

    @Test
    void handleMatchesWithMultipleSettlements_matchesNone_whenNoProcessorSettlement(){
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .build();

        Set<ProcessorSettlement> psSet = Set.of();
        itToPsMap.put(it, new HashSet<>(psSet));

        when(reconciliationRepository.findLedgerTransactionsWithMultipleSettlements()).thenReturn(transactionMapping);
        when(duplicateCategorizer.findDuplicateProcessorSettlements(any())).thenReturn(psSet);
        when(splitCategorizer.findSplitProcessorSettlements(it, psSet)).thenReturn(psSet);

        multiSettlementCoordinator.handleMatchesWithMultipleSettlements();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(0, capturedResult.size());
    }

    @Test
    void handleMatchesWithMultipleSettlements_matchesNone_whenSingleProcessorSettlement(){
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .build();
        ProcessorSettlement ps1 = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .build();

        Set<ProcessorSettlement> psSet = Set.of(ps1);
        itToPsMap.put(it, new HashSet<>(psSet));

        when(reconciliationRepository.findLedgerTransactionsWithMultipleSettlements()).thenReturn(transactionMapping);
        when(duplicateCategorizer.findDuplicateProcessorSettlements(any())).thenReturn(Set.of());
        when(splitCategorizer.findSplitProcessorSettlements(it, psSet)).thenReturn(Set.of());

        multiSettlementCoordinator.handleMatchesWithMultipleSettlements();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(0, capturedResult.size());
    }

}
