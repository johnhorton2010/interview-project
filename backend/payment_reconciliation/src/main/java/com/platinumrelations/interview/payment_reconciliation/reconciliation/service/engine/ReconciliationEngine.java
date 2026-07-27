package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@RequiredArgsConstructor
@Service
public class ReconciliationEngine {

    private final QuarantineCategorizer quarantineCategorizer;
    private final InProgressCategorizer inprogressCategorizer;
    private final UnmatchedCategorizer unmatchedCategorizer;
    private final OrphanRefundCategorizer orphanRefundCategorizer;
    private final SingleSettlementCoordinator singleSettlementCoordinator;
    private final MultiSettlementCoordinator multiSettlementCoordinator;

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

