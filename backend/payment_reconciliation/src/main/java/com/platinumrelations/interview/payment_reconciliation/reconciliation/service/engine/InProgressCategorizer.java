package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.Type;
import com.platinumrelations.interview.payment_reconciliation.ledger.repository.LedgerRepository;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.Category;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.ReconciledTransaction;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.FeeCalculator;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Pairs ledger transactions with settlements, claiming each match as
 * {@link Category#IN_PROGRESS}.
 *
 * <p>Claims rather than judges: a pairing recorded here asserts only that these two rows belong
 * together, leaving what is wrong with them to a later pass. Splitting matching from judging is
 * what lets the arithmetic categorizers assume both sides are present.
 *
 * <p>Two strategies, of unequal confidence. The merchant reference is authoritative when the
 * processor echoes it back and needs no arithmetic. When it is absent, identity has to be inferred
 * from merchant, card type, and last four digits &mdash; which can legitimately fit several
 * transactions &mdash; so the amount is used as the tiebreaker.
 *
 * @author John
 */
@Service
class InProgressCategorizer {

    /**
     * Creates the categorizer.
     *
     * @param ledgerRepository         supplies the candidate pairings for the fallback strategy
     * @param reconciliationRepository stores claims and executes the merchant-reference statement
     * @param feeCalculator            establishes the expected amount used to confirm a fallback match
     */
    InProgressCategorizer(LedgerRepository ledgerRepository, ReconciliationRepository reconciliationRepository, FeeCalculator feeCalculator){
        this.ledgerRepository = ledgerRepository;
        this.feeCalculator = feeCalculator;
        this.reconciliationRepository = reconciliationRepository;
    }

    /** Supplies the candidate pairings for settlements lacking a merchant reference. */
    private final LedgerRepository ledgerRepository;
    /** Stores claims and executes the merchant-reference matching statement. */
    private final ReconciliationRepository reconciliationRepository;
    /** Establishes the expected settled amount used to confirm a fallback match. */
    private final FeeCalculator feeCalculator;

    /**
     * Claims pairings for settlements that arrived without a usable merchant reference.
     *
     * <p>The fallback strategy. Candidates come from a join on merchant, card type, and last four
     * digits, which is deliberately loose and can propose several transactions per settlement. Two
     * further tests narrow it: the settlement's sign must agree with the ledger type, and the
     * settled amount must fall within tolerance of what the fee schedule says that transaction
     * should have produced.
     *
     * <p>Using the expected amount as the tiebreaker has a consequence worth knowing: a settlement
     * that is <em>both</em> missing its reference <em>and</em> wrong in amount will not be claimed
     * here, and will fall through to be reported as unmatched rather than as an amount mismatch.
     * Accepting it on weak identifiers alone would risk attaching it to the wrong transaction,
     * which is the worse error.
     *
     * <p>A candidate that passes every test is still only claimed, not judged; the arithmetic
     * categorizers examine it afterwards like any other pairing.
     *
     * @return a map from each claim written to whether it changed anything; empty when no
     *         settlement lacked a reference or none could be confirmed
     * @throws IllegalArgumentException if a candidate's card type does not name a known network
     * @throws org.springframework.dao.DataAccessException if reading or writing fails
     */
    // Try to find the match for the missing merchant_ref in the processor settlement
    // Basing it on merchant id, card_last4, card_type, and then finally the transaction amounts within tolerance
    Map<ReconciledTransaction, RowStatus> matchingByBackupIdentifiers(){
        TransactionMapping transactionMapping = ledgerRepository.findByBackupIdentification();
        List<ReconciledTransaction> reconList = new ArrayList<>();

        for(Map.Entry<InternalTransaction, Set<ProcessorSettlement>> entry : transactionMapping.internalTransactionToProcessorSettlementsMap().entrySet()){
            InternalTransaction it = entry.getKey();

            for(ProcessorSettlement ps : entry.getValue()){
                // Is the settlement positive for a sale and negative for a refund?
                boolean isTransactionPairingPotentiallyValid =
                        (it.getType().equals(Type.SALE.name()) && ps.getSettledAmount().compareTo(BigDecimal.ZERO) >= 0) ||
                                (it.getType().equals(Type.REFUND.name()) && ps.getSettledAmount().compareTo(BigDecimal.ZERO) < 0);

                if(isTransactionPairingPotentiallyValid){
                    BigDecimal expectedSettlement = feeCalculator.computeExpectedSettlement(it.getCardType(), it.getGrossAmount());

                    if(feeCalculator.isWithinTolerance(ps.getSettledAmount(), expectedSettlement)){
                        reconList.add(new ReconciledTransaction(it.getInternalTxnId(), ps.getNetworkRef(), Category.IN_PROGRESS.name()));
                    }
                }
            }
        }

        return reconciliationRepository.saveAll(reconList);
    }

    /**
     * Claims pairings where the settlement echoes back the merchant reference.
     *
     * <p>The primary strategy, and entirely a SQL matter: the reference identifies the transaction
     * directly, so no arithmetic is needed to confirm the pairing. Only the sign of the settlement
     * must still agree with the ledger type, since a refunded order puts a sale and a refund under
     * the same reference on both sides.
     *
     * <p>Runs after the fallback pass, which is safe because claiming only inserts where a pairing
     * is absent: neither pass can displace the other's work.
     *
     * @return the number of pairings newly claimed
     * @throws org.springframework.dao.DataAccessException if the statement fails
     */
    int matchingByMerchantRef(){
        return reconciliationRepository.createReconciledTransactionWithMatchBasedExactMerchantRef();
    }
}
