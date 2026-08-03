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

/**
 * Resolves pairings of one ledger transaction to exactly one settlement.
 *
 * <p>Applies the categorizers that need arithmetic in a fixed precedence and stops at the first
 * that fires, so a transaction receives exactly one verdict even when several conditions hold. The
 * order encodes which finding is more informative: a wrong principal outranks wrong fees, since
 * fees are only worth checking once the principal is trustworthy, and both outrank a timing
 * anomaly, since late-but-correct money is a lesser concern than money that is wrong.
 * {@link Category#CLEAN_MATCH} is assigned by exclusion once nothing else applies.
 *
 * <p>Must run after {@code MultiSettlementCoordinator}. It reads every pairing still
 * {@link Category#IN_PROGRESS} and requires each to have exactly one settlement, which only holds
 * once the multi-settlement cases have been given terminal categories.
 *
 * @author John
 */
@RequiredArgsConstructor
@Service
class SingleSettlementCoordinator {

    /** Supplies the outstanding pairings and stores the resulting verdicts. */
    private final ReconciliationRepository reconciliationRepository;
    /** Third in precedence: settled correctly, but outside the expected window. */
    private final WideWindowCategorizer wideWindowCategorizer;
    /** First in precedence: the settled principal is not explained by the reported fees. */
    private final AmountMismatchCategorizer amountMismatchCategorizer;
    /** Second in precedence: principal is sound but the reported fees defy the schedule. */
    private final FeeDiscrepancyCategorizer feeDiscrepancyCategorizer;

    /**
     * Assigns a terminal category to every outstanding one-to-one pairing.
     *
     * <p>Checks amount mismatch, then fee discrepancy, then wide window, taking the first that
     * applies; anything surviving all three is a clean match. Verdicts are accumulated and written
     * in a single batch rather than one at a time.
     *
     * @return a map from each verdict written to whether it changed anything; empty when nothing
     *         was outstanding
     * @throws UnexpectedSettlementsException if any pairing has zero or several settlements, which
     *                                        means the multi-settlement phase did not run first or
     *                                        left something unresolved
     * @throws org.springframework.dao.DataAccessException if reading or writing fails
     */
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
