package com.platinumrelations.interview.payment_reconciliation.processor.service;

import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.processor.repository.ProcessorSettlementRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Application logic for storing processor settlement reports.
 *
 * <p>Deliberately thin. Unlike its ledger counterpart it does no parsing, because settlements
 * arrive as an already-structured JSON array rather than a CSV upload; validation is applied by
 * the controller at the request boundary. The layer is kept even so, to hold the transaction and
 * business-rule seam that would otherwise be pushed into the controller.
 *
 * @author John
 */
@Service
public class ProcessorSettlementService {

    /**
     * Creates the service.
     *
     * @param processorSettlementRepository data access for the {@code processor_settlement} table
     */
    public ProcessorSettlementService(ProcessorSettlementRepository processorSettlementRepository){
        this.processorSettlementRepository = processorSettlementRepository;
    }

    /** Data access for the {@code processor_settlement} table. */
    private final ProcessorSettlementRepository processorSettlementRepository;

    /**
     * Stores every supplied settlement that is not already present.
     *
     * <p>Idempotent: a settlement already stored is reported as unchanged rather than overwritten,
     * so re-sending the same payload is safe.
     *
     * @param processorSettlementList settlements to store, already validated by the caller
     * @return a map from {@code networkRef} to whether that row was written or already present
     * @throws org.springframework.dao.DataAccessException if the write fails
     */
    public Map<String, RowStatus> bulkCreateProcessorSettlements(List<ProcessorSettlement> processorSettlementList){
        return processorSettlementRepository.saveAll(processorSettlementList);
    }

    /**
     * Deletes every stored settlement.
     *
     * @return the number of settlements deleted; zero if there were none
     * @throws org.springframework.dao.DataAccessException if the delete fails
     */
    public int removeAllExistingProcessorSettlements(){
        return processorSettlementRepository.deleteAll();
    }
}
