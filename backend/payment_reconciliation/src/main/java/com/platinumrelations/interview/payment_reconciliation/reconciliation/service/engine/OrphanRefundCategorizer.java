package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import org.springframework.stereotype.Service;

/**
 * Flags refunds that have no originating sale.
 *
 * <p>Exists as a pass of its own because an orphan refund is invisible to settlement matching: it
 * can settle perfectly against its own settlement row, so a pipeline that judged only how well
 * things matched would call it a clean match and never report money returned against a sale that
 * does not exist.
 *
 * <p>Runs after matching but before the arithmetic categorizers, so an orphan refund is recognised
 * as such rather than being examined for fee or amount problems it does not have.
 *
 * @author John
 */
@Service
class OrphanRefundCategorizer {

    /**
     * Creates the categorizer.
     *
     * @param reconciliationRepository executes the orphan refund statement
     */
    OrphanRefundCategorizer(ReconciliationRepository reconciliationRepository){
        this.reconciliationRepository = reconciliationRepository;
    }

    /** Executes the orphan refund statement. */
    private final ReconciliationRepository reconciliationRepository;

    /**
     * Re-categorizes refunds whose merchant reference matches no sale in the ledger.
     *
     * @return the number of refunds flagged as orphans
     * @throws org.springframework.dao.DataAccessException if the statement fails
     */
    public int handleOrphanRefund(){
        return reconciliationRepository.createReconciledTransactionWithOrphanRefundFromLedger();
    }
}
