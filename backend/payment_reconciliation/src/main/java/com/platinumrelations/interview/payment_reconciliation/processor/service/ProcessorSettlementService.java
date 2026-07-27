package com.platinumrelations.interview.payment_reconciliation.processor.service;

import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.processor.repository.ProcessorSettlementRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ProcessorSettlementService {

    public ProcessorSettlementService(ProcessorSettlementRepository processorSettlementRepository){
        this.processorSettlementRepository = processorSettlementRepository;
    }

    private final ProcessorSettlementRepository processorSettlementRepository;

    public Map<String, RowStatus> bulkCreateProcessorSettlements(List<ProcessorSettlement> processorSettlementList){
        return processorSettlementRepository.saveAll(processorSettlementList);
    }
}
