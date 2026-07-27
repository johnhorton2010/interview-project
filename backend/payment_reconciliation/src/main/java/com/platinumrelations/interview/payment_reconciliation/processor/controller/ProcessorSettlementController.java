package com.platinumrelations.interview.payment_reconciliation.processor.controller;

import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.processor.service.ProcessorSettlementService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Validated
@RestController
@RequestMapping(value = "${app.custom.restcontroller.prefix}/processor-settlement-transactions")
public class ProcessorSettlementController {

    public ProcessorSettlementController(ProcessorSettlementService processorSettlementService){
        this.processorSettlementService = processorSettlementService;
    }
    final private ProcessorSettlementService processorSettlementService;

    @PutMapping
    public ResponseEntity<Map<String, RowStatus>> bulkCreateProcessorSettlements(@Valid @RequestBody List<ProcessorSettlement> settlementList){
        return ResponseEntity.ok(processorSettlementService.bulkCreateProcessorSettlements(settlementList));
    }
}
