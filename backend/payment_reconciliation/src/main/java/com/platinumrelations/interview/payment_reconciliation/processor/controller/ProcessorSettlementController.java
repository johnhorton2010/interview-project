package com.platinumrelations.interview.payment_reconciliation.processor.controller;

import com.platinumrelations.interview.payment_reconciliation.core.model.RecordCount;
import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.processor.service.ProcessorSettlementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

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

    @Operation(summary = "Attempt to create Processor Settlement Transactions")
    @ApiResponse(responseCode = "200", description = "Created new Processor Settlement Transactions or no change if an individual transaction already exists",
        content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(
                type = "object",
                example = """
                {
                  "ARN74000000000000075752" : "INSERTED_OR_UPDATED",
                  "ARN85000000000000075752" : "NO_CHANGE"
                }
                """
                )
        )
    )
    @PutMapping
    public ResponseEntity<Map<String, RowStatus>> bulkCreateProcessorSettlements(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "Processor Settlement Transactions to create", required = true,
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                        array = @ArraySchema(
                                schema = @Schema(implementation = ProcessorSettlement.class),
                                arraySchema = @Schema(description = "List of Processor Settlements")
                        ),
                        examples = @ExampleObject(value = """
                                                [
                                                {
                                                  "network_ref" : "ARN74000000000000075752",
                                                  "merchant_ref" : "ORD-002-88193",
                                                  "merchant_id" : "MERCH-002",
                                                  "card_last4" : "6408",
                                                  "card_type" : "AMEX",
                                                  "settled_amount" : 606.29,
                                                  "interchange_fee" : 1.93,
                                                  "processor_fee" : 1.93,
                                                  "currency" : "USD",
                                                  "settlement_date" : "2026-06-03"
                                                }
                                                ]
                                """)
            ))
            @Valid @RequestBody List<ProcessorSettlement> settlementList){
        return ResponseEntity.ok(processorSettlementService.bulkCreateProcessorSettlements(settlementList));
    }

    @Operation(summary = "Deletes all existing Processor Settlements")
    @ApiResponse(responseCode = "200", description = "An object representing the number of Processor Settlements deleted",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(
                            type = "object",
                            example = """
                            {
                                "record_count" : 23
                            }
                        """
                    )
            )
    )
    @DeleteMapping
    public ResponseEntity<RecordCount> deleteAllProcessorSettlements(){
        RecordCount recordCount = new RecordCount(processorSettlementService.removeAllExistingProcessorSettlements());
        return ResponseEntity.ok(recordCount);
    }
}
