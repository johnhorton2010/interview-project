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

/**
 * REST endpoints for loading and clearing processor settlement reports.
 *
 * <p>Settlements are accepted as a JSON array rather than a file upload, which is the one
 * structural difference from the ledger endpoints: the processor feed is already structured, so
 * there is no parsing step and validation can be applied directly at the request boundary.
 * {@code @Validated} is what activates the {@code @Valid} constraint on the list's elements.
 *
 * <p>Mounted under the configurable {@code app.custom.restcontroller.prefix}. Failures are not
 * caught here; they propagate to {@code GlobalRestControllerExceptionHandler}.
 *
 * @author John
 */
@Validated
@RestController
@RequestMapping(value = "${app.custom.restcontroller.prefix}/processor-settlement-transactions")
public class ProcessorSettlementController {

    /**
     * Creates the controller.
     *
     * @param processorSettlementService service performing the storage work
     */
    public ProcessorSettlementController(ProcessorSettlementService processorSettlementService){
        this.processorSettlementService = processorSettlementService;
    }

    /** Service this controller delegates all settlement work to. */
    final private ProcessorSettlementService processorSettlementService;

    /**
     * Bulk-loads settlement reports from a JSON array.
     *
     * <p>Mapped to {@code PUT} because the operation is idempotent: a settlement already stored is
     * reported as {@code NO_CHANGE} and left untouched. The per-row result is returned rather than
     * a bare count so the caller can tell exactly which settlements were new.
     *
     * <p>Each element is bean-validated before this method body runs, so a blank
     * {@code networkRef} rejects the whole request rather than storing an unaddressable row. The
     * resulting framework validation failure is handled by
     * {@code GlobalRestControllerExceptionHandler} and surfaces as {@code 400 Bad Request} with
     * nothing stored.
     *
     * @param settlementList the settlements to store
     * @return {@code 200 OK} with a map from {@code networkRef} to the outcome for that row
     * @throws org.springframework.dao.DataAccessException if the write fails, surfacing as
     *                                                     {@code 500 Internal Server Error}
     */
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
            @RequestBody List<@Valid ProcessorSettlement> settlementList){
        return ResponseEntity.ok(processorSettlementService.bulkCreateProcessorSettlements(settlementList));
    }

    /**
     * Deletes every stored settlement.
     *
     * <p>Unconditional and unfiltered; provided to reset the settlement feed between runs against
     * different data sets. The ledger and recorded reconciliation results are not affected.
     *
     * @return {@code 200 OK} wrapping the number of settlements deleted
     */
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
