package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.Type;
import com.platinumrelations.interview.payment_reconciliation.ledger.repository.LedgerRepository;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.Category;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.ReconciledTransaction;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.FeeCalculator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class InProgressCategorizerTest {

    @Mock
    private LedgerRepository ledgerRepository;
    @Mock
    private FeeCalculator feeCalculator;
    @Mock
    private ReconciliationRepository reconciliationRepository;

    @InjectMocks
    private InProgressCategorizer inProgressCategorizer;

    @Captor
    ArgumentCaptor<List<ReconciledTransaction>> rtListCaptor;

    @Test
    void matchingByBackupIdentifiers_matchesAsInProgress_whenSaleTypeLedgerAndPositiveSettlementAmountAndInTolerance(){
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .type(Type.SALE.name())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settledAmount(new BigDecimal("100"))
                .build();
        itToPsMap.put(it, new HashSet<>(List.of(ps)));

        when(ledgerRepository.findByBackupIdentification()).thenReturn(transactionMapping);
        when(feeCalculator.isWithinTolerance(any(), any())).thenReturn(Boolean.TRUE);

        inProgressCategorizer.matchingByBackupIdentifiers();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(1, capturedResult.size());
        assertEquals(1, capturedResult.stream().filter(reconciledTransaction -> reconciledTransaction.category().equals(Category.IN_PROGRESS.name())).count());
    }

    @Test
    void matchingByBackupIdentifiers_noneAsInProgress_whenSaleTypeLedgerAndPositiveSettlementAmountAndOutOfTolerance(){
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .type(Type.SALE.name())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settledAmount(new BigDecimal("100"))
                .build();
        itToPsMap.put(it, new HashSet<>(List.of(ps)));

        when(ledgerRepository.findByBackupIdentification()).thenReturn(transactionMapping);
        when(feeCalculator.isWithinTolerance(any(), any())).thenReturn(Boolean.FALSE);

        inProgressCategorizer.matchingByBackupIdentifiers();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(0, capturedResult.size());
    }

    @Test
    void matchingByBackupIdentifiers_noneAsInProgress_whenSaleTypeLedgerAndNegativeSettlementAmountAndInTolerance(){
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .type(Type.SALE.name())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settledAmount(new BigDecimal("-100"))
                .build();
        itToPsMap.put(it, new HashSet<>(List.of(ps)));

        when(ledgerRepository.findByBackupIdentification()).thenReturn(transactionMapping);

        inProgressCategorizer.matchingByBackupIdentifiers();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(0, capturedResult.size());
    }

    @Test
    void matchingByBackupIdentifiers_matchesAsInProgress_whenRefundTypeLedgerAndNegativeSettlementAmountAndInTolerance(){
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .type(Type.REFUND.name())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settledAmount(new BigDecimal("-100"))
                .build();
        itToPsMap.put(it, new HashSet<>(List.of(ps)));

        when(ledgerRepository.findByBackupIdentification()).thenReturn(transactionMapping);
        when(feeCalculator.isWithinTolerance(any(), any())).thenReturn(Boolean.TRUE);

        inProgressCategorizer.matchingByBackupIdentifiers();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(1, capturedResult.size());
        assertEquals(1, capturedResult.stream().filter(reconciledTransaction -> reconciledTransaction.category().equals(Category.IN_PROGRESS.name())).count());
    }

    @Test
    void matchingByBackupIdentifiers_noneAsInProgress_whenRefundTypeLedgerAndNegativeSettlementAmountAndOutOfTolerance(){
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .type(Type.REFUND.name())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settledAmount(new BigDecimal("-100"))
                .build();
        itToPsMap.put(it, new HashSet<>(List.of(ps)));

        when(ledgerRepository.findByBackupIdentification()).thenReturn(transactionMapping);
        when(feeCalculator.isWithinTolerance(any(), any())).thenReturn(Boolean.FALSE);

        inProgressCategorizer.matchingByBackupIdentifiers();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(0, capturedResult.size());
    }

    @Test
    void matchingByBackupIdentifiers_noneAsInProgress_whenRefundTypeLedgerAndPositiveSettlementAmountAndInTolerance(){
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, null, null);

        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .type(Type.REFUND.name())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settledAmount(new BigDecimal("100"))
                .build();
        itToPsMap.put(it, new HashSet<>(List.of(ps)));

        when(ledgerRepository.findByBackupIdentification()).thenReturn(transactionMapping);

        inProgressCategorizer.matchingByBackupIdentifiers();

        verify(reconciliationRepository).saveAll(rtListCaptor.capture());
        List<ReconciledTransaction> capturedResult = rtListCaptor.getValue();

        assertEquals(0, capturedResult.size());
    }
}
