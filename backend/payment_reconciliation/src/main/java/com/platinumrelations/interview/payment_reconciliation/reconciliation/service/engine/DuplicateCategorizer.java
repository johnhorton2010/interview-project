package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.processor.util.ProcessorSettlementComparator;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;
import java.util.TreeSet;

@Service
class DuplicateCategorizer {

    Set<ProcessorSettlement> findDuplicateProcessorSettlements(Set<ProcessorSettlement> psSet){
        // TreeSet allows for a custom comparator and as a set will fail to add non unique objects
        TreeSet<ProcessorSettlement> psTreeSet = new TreeSet<>(ProcessorSettlementComparator.compareWithoutNetworkRef);
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
