package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.processor.util.ProcessorSettlementComparator;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;
import java.util.TreeSet;

/**
 * Finds settlements that report the same economic event more than once.
 *
 * <p>A duplicated settlement carries a different network reference from its twin &mdash; the
 * processor issued a genuinely new settlement record &mdash; so identity cannot be used to detect
 * it. Sameness has to be defined over every other field instead, which is what
 * {@code ProcessorSettlementComparator} provides.
 *
 * <p>Stateless, holding no collaborators: the comparison rule lives with the settlement model
 * rather than here.
 *
 * @author John
 */
@Service
class DuplicateCategorizer {

    /**
     * Returns every settlement in the group that participates in a duplicate pair.
     *
     * <p>Both sides of a pair are returned, not just the later one. Neither report is inherently
     * the wrong one &mdash; the merchant was paid twice and both rows explain that &mdash; so
     * reporting only the second would leave the break half-described.
     *
     * <p>Detection uses a {@link TreeSet} ordered by the field-wise comparator rather than a
     * {@link HashSet}, because membership must follow that comparator rather than
     * {@code ProcessorSettlement}'s identifier-based equality. A rejected insertion is what
     * identifies the newcomer as a duplicate, and the existing twin is then recovered from the
     * tree.
     *
     * <p>Three or more identical settlements all appear in the result, since each insertion after
     * the first is rejected.
     *
     * @param psSet the settlements matched to one ledger transaction; not modified
     * @return the settlements taking part in a duplicate pair, or an empty set when all are
     *         distinct
     * @throws NullPointerException if any compared field is {@code null}, which the comparator
     *                              does not tolerate
     */
    Set<ProcessorSettlement> findDuplicateProcessorSettlements(Set<ProcessorSettlement> psSet){
        // TreeSet allows for a custom comparator and as a set will fail to add non unique objects
        TreeSet<ProcessorSettlement> psTreeSet = new TreeSet<>(ProcessorSettlementComparator.compareWithoutNetworkRefAndCategory);
        Set<ProcessorSettlement> duplicateProcessorSettlements = new HashSet<>();
        for(ProcessorSettlement ps : psSet){
            if(!psTreeSet.add(ps)){
                // This is the newly encountered ps that failed to add due to a pre-existing ps in the set
                duplicateProcessorSettlements.add(ps);
                // This is the original ps that caused the add to fail
                duplicateProcessorSettlements.add(psTreeSet.floor(ps));
            }
        }

        return duplicateProcessorSettlements;
    }
}
