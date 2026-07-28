package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.exception.UnexpectedSettlementsException;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.Category;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.ReconciledTransaction;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RequiredArgsConstructor
@Service
class SingleSettlementCoordinator {

    private final ReconciliationRepository reconciliationRepository;
    private final WideWindowCategorizer wideWindowCategorizer;
    private final AmountMismatchCategorizer amountMismatchCategorizer;
    private final FeeDiscrepancyCategorizer feeDiscrepancyCategorizer;

    // amount mismatch, fee discrepancy, wide window, and finally by exclusion clean transaction
    public Map<ReconciledTransaction, RowStatus> handleMatchesWithSingleSettlement(){
        TransactionMapping transactionMapping = reconciliationRepository.findMatchedTransactionsInProgress();
        Map<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = transactionMapping.internalTransactionToProcessorSettlementsMap();
        List<ReconciledTransaction> reconList = new ArrayList<>();

        // iterate through and check for the remaining categories
        itToPsMap.forEach((it, psList) -> {
            if(psList.size() != 1){
                String message = "Expecting a mapping of one internal transaction to one processor settlement but zero " +
                        "or more than one settlement was detected for a given internal transaction.";
                throw new UnexpectedSettlementsException(message);
            }
            ProcessorSettlement ps = psList.iterator().next();

            if(amountMismatchCategorizer.hasAmountMismatch(it, ps)){
                reconList.add(new ReconciledTransaction(it.getInternalTxnId(), ps.getNetworkRef(), Category.AMOUNT_MISMATCH.name()));
                return;
            }

            if(feeDiscrepancyCategorizer.hasFeeDiscrepancy(it, ps)){
                reconList.add(new ReconciledTransaction(it.getInternalTxnId(), ps.getNetworkRef(), Category.FEE_DISCREPANCY.name()));
                return;
            }

            if(wideWindowCategorizer.hasWideWindow(it,ps)){
                reconList.add(new ReconciledTransaction(it.getInternalTxnId(), ps.getNetworkRef(), Category.WIDE_WINDOW.name()));
                return;
            }

            // determined to be a clean match by exclusion of all the other categories
            reconList.add(new ReconciledTransaction(it.getInternalTxnId(), ps.getNetworkRef(), Category.CLEAN_MATCH.name()));
        });

        return reconciliationRepository.saveAll(reconList);
    }
}
