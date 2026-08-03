package com.platinumrelations.interview.payment_reconciliation.reconciliation.service;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.springframework.stereotype.Service;

/**
 * Read and clear-down operations over recorded reconciliation results.
 *
 * <p>Deliberately does not run reconciliation. Producing verdicts is the engine's job; this
 * service only serves results that already exist and discards them on request. Keeping the two
 * apart means a reporting call cannot accidentally trigger a run.
 *
 * @author John
 */
@Service
public class ReconciliationService {

    /**
     * Creates the service.
     *
     * @param reconciliationRepository data access for {@code reconciled_transactions}
     */
    public ReconciliationService(ReconciliationRepository reconciliationRepository){
        this.reconciliationRepository = reconciliationRepository;
    }

    /** Data access for {@code reconciled_transactions}. */
    private final ReconciliationRepository reconciliationRepository;

    /**
     * Returns every finished verdict, for reporting.
     *
     * <p>Pairings still being worked on are excluded, so what comes back is a settled picture
     * rather than a snapshot of a run in flight. One-sided results are included, and the missing
     * side of those is represented by a sentinel key.
     *
     * @return the finished verdicts indexed three ways; empty rather than {@code null} before any
     *         run has completed
     * @throws org.springframework.dao.DataAccessException if the query fails
     */
    public TransactionMapping retrieveAllReconciledTransactions(){
        return reconciliationRepository.findAllReconciledTransactions();
    }

    /**
     * Discards every recorded verdict.
     *
     * <p>Leaves the ledger and settlement data untouched, so this returns the system exactly to
     * its pre-reconciliation state and a fresh run can be started from unchanged inputs.
     *
     * @return the number of verdicts deleted; zero if none had been recorded
     * @throws org.springframework.dao.DataAccessException if the delete fails
     */
    public int removeAllExistingReconciledTransactions(){
        return reconciliationRepository.deleteAll();
    }
}
