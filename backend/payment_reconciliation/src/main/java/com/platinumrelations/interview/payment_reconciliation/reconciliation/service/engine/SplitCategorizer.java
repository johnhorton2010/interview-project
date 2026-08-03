package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.FeeCalculator;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;

/**
 * Finds settlements that together make up one capture, rather than repeating it.
 *
 * <p>A split settlement is legitimate: one capture settles as several partial rows with the fees
 * apportioned across them. What distinguishes it from a duplicate is arithmetic &mdash; split rows
 * <em>sum</em> to the expected net, duplicated rows each <em>repeat</em> it &mdash; so unlike
 * duplicate detection this needs the fee schedule to establish what the expected net is.
 *
 * <p>Depends on {@link DuplicateCategorizer} to strip duplicates before summing. A duplicated row
 * left in the total would inflate it and make a genuine split fail to add up, so the two
 * categorizers are ordered rather than independent.
 *
 * <p><strong>Simplifying assumption:</strong> the implementation tests whether <em>all</em>
 * remaining settlements sum to the expected net. It does not search for a subset that does. A
 * group containing a genuine split plus one unrelated settlement therefore fails the test and is
 * reported as no split at all, rather than as a split with an extra row. Subset-sum searching was
 * judged not worth the cost and the false-positive risk for the volumes involved; the conservative
 * failure leaves the rows uncategorized rather than mislabelling them.
 *
 * @author John
 */
@Service
class SplitCategorizer {

    /**
     * Creates the categorizer.
     *
     * @param duplicateCategorizer identifies the duplicates to exclude before summing
     * @param feeCalculator        establishes the expected net and owns the tolerance band
     */
    SplitCategorizer(DuplicateCategorizer duplicateCategorizer, FeeCalculator feeCalculator){
        this.duplicateCategorizer = duplicateCategorizer;
        this.feeCalculator = feeCalculator;
    }

    /** Identifies the duplicates removed before summing. */
    private final DuplicateCategorizer duplicateCategorizer;
    /** Establishes the expected net and owns the tolerance band. */
    private final FeeCalculator feeCalculator;

    /**
     * Returns the settlements forming a split of one ledger transaction.
     *
     * <p>Copies the group, removes any duplicates from the copy, then tests whether what remains
     * sums to the expected settlement within tolerance. Comparing within tolerance rather than
     * exactly matters more here than elsewhere: fees are apportioned across the parts and each is
     * rounded independently, so the parts can legitimately miss the whole by a cent.
     *
     * <p>The supplied set is never modified, so the caller may reuse it for duplicate
     * categorization.
     *
     * @param it    the ledger transaction the group was matched to, supplying card network and
     *              gross amount
     * @param psSet every settlement matched to that transaction, duplicates included; not modified
     * @return the settlements making up the split, or an empty set if the remainder does not sum
     *         to the expected net
     * @throws IllegalArgumentException if the card type does not name a known network
     * @throws NullPointerException     if an amount is {@code null}, or if a compared field is
     *                                  {@code null} during duplicate detection
     */
    Set<ProcessorSettlement> findSplitProcessorSettlements(InternalTransaction it, Set<ProcessorSettlement> psSet){
        // Defensively copy the psSet passed in, find its duplicates, and remove the duplicates from the copy in preparation for the split
        Set<ProcessorSettlement> potentialSplitProcessorSettlements = new HashSet<>(psSet);
        Set<ProcessorSettlement> duplicateProcessorSettlements = duplicateCategorizer.findDuplicateProcessorSettlements(psSet);
        potentialSplitProcessorSettlements.removeAll(duplicateProcessorSettlements);

        // Going to make a basic assumption that ALL remaining add up to the gross amount(within tolerance)
        // NOT checking if any combination of remaining exists that add up to the gross amount(within tolerance)
        BigDecimal expectedSettlement = feeCalculator.computeExpectedSettlement(it.getCardType(), it.getGrossAmount());
        BigDecimal potentialSplitTotal = BigDecimal.ZERO;

        for(ProcessorSettlement ps : potentialSplitProcessorSettlements){
            potentialSplitTotal = potentialSplitTotal.add(ps.getSettledAmount());
        }

        // If the total calculated is within tolerance than the settlements are a split of the ledger transaciton
        if(feeCalculator.isWithinTolerance(potentialSplitTotal, expectedSettlement)){
            return potentialSplitProcessorSettlements;
        }

        // No splits found so return an empty set
        return Set.of();
    }
}
