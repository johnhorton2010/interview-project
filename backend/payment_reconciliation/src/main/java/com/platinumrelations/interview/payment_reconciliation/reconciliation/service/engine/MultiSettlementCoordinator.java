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

/**
 * Resolves pairings where one ledger transaction matched several settlements.
 *
 * <p>Separating {@link Category#DUPLICATE} from {@link Category#SPLIT} is the whole job, and the
 * two look identical until the amounts are examined: duplicated rows each <em>repeat</em> the
 * expected net, while split rows <em>sum</em> to it. Getting this wrong matters in both directions
 * &mdash; a split counted as duplicates invents an overpayment that never happened, and duplicates
 * counted as a split conceals a real one.
 *
 * <p>Duplicates are identified first, and the split test then runs on what remains. That ordering
 * is what keeps the two disjoint: a duplicated row left in the set would distort the sum and could
 * make a genuine split fail to add up.
 *
 * <p>Runs before {@code SingleSettlementCoordinator}, which cannot handle these groups.
 *
 * @author John
 */
@Service
class MultiSettlementCoordinator {

    /**
     * Creates the coordinator.
     *
     * @param reconciliationRepository supplies the multi-settlement groups and stores the verdicts
     * @param duplicateCategorizer     identifies settlements repeating the same economic event
     * @param splitCategorizer         identifies settlements that together sum to the expected net
     */
    MultiSettlementCoordinator(ReconciliationRepository reconciliationRepository, DuplicateCategorizer duplicateCategorizer, SplitCategorizer splitCategorizer){
        this.reconciliationRepository = reconciliationRepository;
        this.duplicateCategorizer = duplicateCategorizer;
        this. splitCategorizer = splitCategorizer;
    }

    /** Supplies the multi-settlement groups and stores the resulting verdicts. */
    private final ReconciliationRepository reconciliationRepository;
    /** Identifies settlements that repeat one another; applied first. */
    private final DuplicateCategorizer duplicateCategorizer;
    /** Identifies settlements that sum to the expected net; applied to what duplicates leave behind. */
    private final SplitCategorizer splitCategorizer;

    /**
     * Categorizes every settlement in every multi-settlement group.
     *
     * <p>Unlike the single-settlement path, a verdict is written per <em>settlement</em> rather
     * than per transaction, since one transaction's group can contain both duplicated and split
     * rows. A settlement that is neither is left {@link Category#IN_PROGRESS} and will not be
     * reported, which is the known gap in handling groups that fit no recognised shape.
     *
     * @return a map from each verdict written to whether it changed anything; empty when no
     *         transaction had more than one settlement
     * @throws org.springframework.dao.DataAccessException if reading or writing fails
     */
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
