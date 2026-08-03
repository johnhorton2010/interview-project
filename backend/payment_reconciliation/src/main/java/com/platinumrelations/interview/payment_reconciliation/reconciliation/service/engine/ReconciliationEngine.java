package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs the reconciliation pipeline, assigning every transaction and settlement a category.
 *
 * <p>The public face of the {@code engine} package; every collaborator it drives is
 * package-private, so the whole pipeline is reachable only through {@link #reconcile()}.
 *
 * <p>The pipeline runs in four phases, and <strong>the order is load-bearing</strong>:
 * <ol>
 *   <li><em>Clean up</em> &mdash; quarantine unusable rows. First, so later phases never see them
 *       and cannot produce spurious breaks from data that was never comparable.</li>
 *   <li><em>Matching</em> &mdash; claim pairings as
 *       {@link com.platinumrelations.interview.payment_reconciliation.reconciliation.model.Category#IN_PROGRESS}. The weaker
 *       backup-identifier pass runs before the exact merchant-reference pass; because claiming
 *       only inserts where a pairing is absent, the exact pass cannot be displaced by the
 *       approximate one.</li>
 *   <li><em>Categorize by database relation</em> &mdash; the verdicts decidable in SQL from set
 *       membership alone: orphan refunds, then anything left unmatched on either side. These must
 *       follow matching, since "unmatched" is defined as having no claim.</li>
 *   <li><em>Categorize with processing</em> &mdash; the verdicts needing the fee schedule or the
 *       business-day calendar. Multi-settlement groups are resolved <em>before</em> single
 *       settlements, and that ordering is required rather than incidental: the single-settlement
 *       coordinator treats a transaction with anything other than exactly one settlement as a
 *       pipeline error, so the multi-settlement cases must already have been given terminal
 *       categories by the time it runs.</li>
 * </ol>
 *
 * <p>The whole run is one transaction, so a failure in any phase discards every verdict from that
 * run rather than leaving the table half-judged.
 *
 * @author John
 */
@RequiredArgsConstructor
@Service
public class ReconciliationEngine {

    /** Phase 1: removes unusable rows from consideration. */
    private final QuarantineCategorizer quarantineCategorizer;
    /** Phase 2: claims pairings for later judgement. */
    private final InProgressCategorizer inprogressCategorizer;
    /** Phase 3: categorizes what matched nothing on either side. */
    private final UnmatchedCategorizer unmatchedCategorizer;
    /** Phase 3: categorizes refunds with no originating sale. */
    private final OrphanRefundCategorizer orphanRefundCategorizer;
    /** Phase 4: resolves one-to-one pairings; requires phase 4's multi-settlement step to have run. */
    private final SingleSettlementCoordinator singleSettlementCoordinator;
    /** Phase 4: resolves one-to-many pairings into duplicates and splits. */
    private final MultiSettlementCoordinator multiSettlementCoordinator;

    /**
     * Runs every phase of the pipeline over the currently loaded data.
     *
     * <p>Safe to re-run. Verdicts already reached are never overwritten, so a second call decides
     * only what the first left outstanding and reports a correspondingly smaller count.
     *
     * <p>The returned count measures work done by this call, not the size of the data set. Note
     * that the two matching calls are excluded from it deliberately: they claim pairings rather
     * than judging them, and counting a pairing when claimed and again when categorized would
     * double-count it.
     *
     * @return the number of transactions given a terminal category by this run; zero when a
     *         previous run already categorized everything
     * @throws com.platinumrelations.interview.payment_reconciliation.reconciliation.exception.UnexpectedSettlementsException
     *                                        if a transaction reaches the single-settlement
     *                                        coordinator with a settlement count it cannot handle,
     *                                        which indicates the phases have fallen out of step;
     *                                        the whole run is rolled back
     * @throws org.springframework.dao.DataAccessException if any statement fails, likewise rolling
     *                                        back the whole run
     */
    @Transactional
    public int reconcile(){
        int reconciledTransactionsChanged=0;

        //Clean Up
        reconciledTransactionsChanged+=quarantineCategorizer.handleQuarantineBadTransactionsInLedger();
        reconciledTransactionsChanged+=quarantineCategorizer.handleQuarantineBadTransactionsInSettlement();

        //Matching
        inprogressCategorizer.matchingByBackupIdentifiers();
        inprogressCategorizer.matchingByMerchantRef();

        //Categorize by database relation
        reconciledTransactionsChanged+=orphanRefundCategorizer.handleOrphanRefund();
        reconciledTransactionsChanged+=unmatchedCategorizer.handleUnmatchedInternalInLedger();
        reconciledTransactionsChanged+=unmatchedCategorizer.handleUnmatchedInProcessorSettlement();

        //Categorize with processing
        reconciledTransactionsChanged+=multiSettlementCoordinator.handleMatchesWithMultipleSettlements().size();
        reconciledTransactionsChanged+=singleSettlementCoordinator.handleMatchesWithSingleSettlement().size();

        return reconciledTransactionsChanged;
    }
}

