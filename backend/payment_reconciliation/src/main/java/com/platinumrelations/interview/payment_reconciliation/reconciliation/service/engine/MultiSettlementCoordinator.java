package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.Category;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.ReconciledTransaction;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
class MultiSettlementCoordinator {

    MultiSettlementCoordinator(ReconciliationRepository reconciliationRepository, DuplicateCategorizer duplicateCategorizer, SplitCategorizer splitCategorizer){
        this.reconciliationRepository = reconciliationRepository;
        this.duplicateCategorizer = duplicateCategorizer;
        this. splitCategorizer = splitCategorizer;
    }

    private final ReconciliationRepository reconciliationRepository;
    private final DuplicateCategorizer duplicateCategorizer;
    private final SplitCategorizer splitCategorizer;

    // duplicates and splits...
    public Map<ReconciledTransaction, RowStatus> handleMatchesWithMultipleSettlements(){
        TransactionMapping transactionMapping = reconciliationRepository.findLedgerTransactionsWithMultipleSettlements();
        Map<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = transactionMapping.internalTransactionToProcessorSettlementsMap();

        List<ReconciledTransaction> reconList = new ArrayList<>();
        itToPsMap.forEach((it, psSet) -> {

            Set<ProcessorSettlement> duplicateProcessorSettlements = duplicateCategorizer.findDuplicateProcessorSettlements(psSet);
            for(ProcessorSettlement ps : duplicateProcessorSettlements){
                reconList.add(new ReconciledTransaction(it.getInternalTxnId(), ps.getNetworkRef(), Category.DUPLICATE.name()));
            }

            Set<ProcessorSettlement> splitProcessorSettlement = splitCategorizer.findSplitProcessorSettlements(it, psSet);
            for(ProcessorSettlement ps : splitProcessorSettlement){
                reconList.add(new ReconciledTransaction(it.getInternalTxnId(), ps.getNetworkRef(), Category.SPLIT.name()));
            }
        });

        return reconciliationRepository.saveAll(reconList);
    }
}
