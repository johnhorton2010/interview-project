package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.FeeCalculator;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;

@Service
class SplitCategorizer {

    SplitCategorizer(DuplicateCategorizer duplicateCategorizer, FeeCalculator feeCalculator){
        this.duplicateCategorizer = duplicateCategorizer;
        this.feeCalculator = feeCalculator;
    }

    private final DuplicateCategorizer duplicateCategorizer;
    private final FeeCalculator feeCalculator;

    Set<ProcessorSettlement> findSplitProcessorSettlements(InternalTransaction it, Set<ProcessorSettlement> psSet){
        // Defensively copy the psSet passed in, find its duplicates, and remove the duplicates from the copy in preparation for the split
        Set<ProcessorSettlement> potentialSplitProcessorSettlements = new HashSet<>(psSet);
        Set<ProcessorSettlement> duplicateProcessorSettlements = duplicateCategorizer.findDuplicateProcessorSettlements(psSet);
        potentialSplitProcessorSettlements.removeAll(duplicateProcessorSettlements);

        // Going to make a basic assumption that ALL remaining add up to the gross amount(within tolerance)
        // NOT checking if any combination of remaining exists that add up to the gross amount(within tolerance)
        BigDecimal expectedSettlement = feeCalculator.computeExpectedSettlement(it.cardType(), it.grossAmount());
        BigDecimal potentialSplitTotal = BigDecimal.ZERO;

        for(ProcessorSettlement ps : potentialSplitProcessorSettlements){
            potentialSplitTotal = potentialSplitTotal.add(ps.settledAmount());
        }

        // If the total calculated is within tolerance than the settlements are a split of the ledger transaciton
        if(feeCalculator.isWithinTolerance(potentialSplitTotal, expectedSettlement)){
            return potentialSplitProcessorSettlements;
        }

        // No splits found so return an empty set
        return Set.of();
    }
}
