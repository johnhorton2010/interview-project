package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.springframework.stereotype.Service;

/**
 * Flags rows that no matching pass claimed, on either side.
 *
 * <p>Strictly order-dependent: "unmatched" means "carries no verdict of any kind", which is only
 * true once every matching pass has run. Invoked earlier, these operations would claim rows that
 * matching simply had not reached yet and permanently mislabel them.
 *
 * <p>The two sides are equally unmatched but not equally serious. A ledger transaction that never
 * settled is money owed or a dropped payout; a settlement with no ledger record is money that
 * moved against a transaction the merchant never recorded, which is a risk signal rather than an
 * accounting gap.
 *
 * @author John
 */
@Service
class UnmatchedCategorizer {

    /**
     * Creates the categorizer.
     *
     * @param reconciliationRepository executes the unmatched statements
     */
    UnmatchedCategorizer(ReconciliationRepository reconciliationRepository){
        this.reconciliationRepository = reconciliationRepository;
    }

    /** Executes the unmatched statements. */
    private final ReconciliationRepository reconciliationRepository;

    /**
     * Flags ledger transactions that never settled.
     *
     * @return the number of ledger transactions flagged as unmatched
     * @throws org.springframework.dao.DataAccessException if the statement fails
     */
    // existing ledger without corresponding settlement transaction
    public int handleUnmatchedInternalInLedger(){
        return reconciliationRepository.createReconciledTransactionWithUnmatchedInternalFromLedger();
    }

    /**
     * Flags settlements with no corresponding ledger transaction.
     *
     * @return the number of settlements flagged as unmatched
     * @throws org.springframework.dao.DataAccessException if the statement fails
     */
    // existing processor settlement without corresponding ledger transaction
    public int handleUnmatchedInProcessorSettlement(){
        return reconciliationRepository.createReconciledTransactionWithUnmatchedSettlementFromProcessorSettlement();
    }
}
