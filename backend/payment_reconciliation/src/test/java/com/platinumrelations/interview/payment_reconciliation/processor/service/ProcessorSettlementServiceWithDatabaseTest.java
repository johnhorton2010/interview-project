package com.platinumrelations.interview.payment_reconciliation.processor.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@Transactional
public class ProcessorSettlementServiceWithDatabaseTest {
    @Autowired
    ProcessorSettlementService processorSettlementService;

    @Test
    void removeAllExistingProcessorSettlements_success_happyPath(){
        assertEquals(19, processorSettlementService.removeAllExistingProcessorSettlements());
    }
}
