package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.springframework.stereotype.Service;

/**
 * Removes rows whose own data is unusable from the rest of the pipeline.
 *
 * <p>Runs first, and that placement is the point. A row with malformed values cannot be compared
 * meaningfully, so leaving it in circulation would let it match something by accident and produce
 * a break that describes a data defect rather than a payment problem.
 *
 * <p>Both operations delegate entirely to SQL, since membership of the bad set is decidable
 * without inspecting any row in Java. Note the limitation inherited from those statements: bad
 * rows are recognised by identifier naming conventions in the supplied data, not by validating
 * field contents.
 *
 * @author John
 */
@Service
class QuarantineCategorizer {

    /**
     * Creates the categorizer.
     *
     * @param reconciliationRepository executes the quarantine statements
     */
    private QuarantineCategorizer(ReconciliationRepository reconciliationRepository){
        this.reconciliationRepository = reconciliationRepository;
    }

    /** Executes the quarantine statements. */
    private final ReconciliationRepository reconciliationRepository;

    /**
     * Quarantines unusable ledger transactions.
     *
     * @return the number of ledger transactions quarantined
     * @throws org.springframework.dao.DataAccessException if the statement fails
     */
    public int handleQuarantineBadTransactionsInLedger(){
        return reconciliationRepository.createReconciledTransactionWithQuarantineFromLedger();
    }

    /**
     * Quarantines unusable settlements.
     *
     * @return the number of settlements quarantined
     * @throws org.springframework.dao.DataAccessException if the statement fails
     */
    //Look for Bad Settlement
    public int handleQuarantineBadTransactionsInSettlement(){
        return reconciliationRepository.createReconciledTransactionWithQuarantineFromProcessorSettlement();
    }
}
