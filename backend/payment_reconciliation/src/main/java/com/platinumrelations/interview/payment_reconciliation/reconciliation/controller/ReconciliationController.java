package com.platinumrelations.interview.payment_reconciliation.reconciliation.controller;

import com.platinumrelations.interview.payment_reconciliation.core.model.RecordCount;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.ReconciliationService;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine.ReconciliationEngine;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(value = "${app.custom.restcontroller.prefix}/reconciliations")
public class ReconciliationController {

    public ReconciliationController(ReconciliationEngine reconciliationEngine, ReconciliationService reconciliationService){
        this.reconciliationEngine = reconciliationEngine;
        this.reconciliationService = reconciliationService;
    }

    final ReconciliationEngine reconciliationEngine;
    final ReconciliationService reconciliationService;

    @Operation(summary = "Kick off the reconciliation process based on existing Ledger Internal Transactions and ProcessorSettlementTransactions")
    @ApiResponse(responseCode = "200", description = "An object representing the number of new Reconciled Transactions created",
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
    @PostMapping
    public ResponseEntity<RecordCount> reconcile(){
        RecordCount recordCount = new RecordCount(reconciliationEngine.reconcile());
        return ResponseEntity.ok(recordCount);
    }

    @Operation(summary = "Retrieves the current mappings of Ledger Internal Transaction to Processor Settlement Transactions as Reconciled Transactions")
    @ApiResponse(responseCode = "200", description = "The mappings of the current Reconciled Transactions",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(
                            type = "object",
                            example = """
                        {
                          "internal_transaction_to_processor_settlements_map" : {
                            "TXN-000002" : [ {
                              "network_ref" : "ARN74000000000000048583",
                              "merchant_ref" : "ORD-006-29772",
                              "merchant_id" : "MERCH-006",
                              "card_last4" : "1241",
                              "card_type" : "MASTERCARD",
                              "settled_amount" : 343.72,
                              "interchange_fee" : 6.78,
                              "processor_fee" : 1.1,
                              "currency" : "USD",
                              "settlement_date" : "2026-06-08",
                              "category" : "CLEAN_MATCH"
                            } ]
                          },
                          "processor_settlement_to_internal_transactions_map" : {
                            "ARN74000000000000048583" : [ {
                              "internal_txn_id" : "TXN-000002",
                              "merchant_id" : "MERCH-006",
                              "merchant_ref" : "ORD-006-29772",
                              "card_type" : "MASTERCARD",
                              "card_last4" : "1241",
                              "gross_amount" : 351.6,
                              "currency" : "USD",
                              "type" : "SALE",
                              "captured_at" : "2026-06-06T00:00:00Z",
                              "category" : "CLEAN_MATCH"
                            } ]
                          },
                          "merchant_ref_to_transaction_keys_map" : {
                            "ORD-006-29772" : {
                              "internalTransactions" : [ "TXN-000002" ],
                              "processorSettlements" : [ "ARN74000000000000048583" ]
                            }
                          }
                        }
                        """
                    )
            )
    )
    @GetMapping
    public ResponseEntity<TransactionMapping> retrieveAllReconciledTransactions(){
        return ResponseEntity.ok(reconciliationService.retrieveAllReconciledTransactions());
    }

    @Operation(summary = "Deletes all existing Reconciled Transactions")
    @ApiResponse(responseCode = "200", description = "An object representing the number of Reconciled Transactions deleted",
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
    public ResponseEntity<RecordCount> deleteAllReconciledTransactions(){
        RecordCount recordCount = new RecordCount(reconciliationService.removeAllExistingReconciledTransactions());
        return ResponseEntity.ok(recordCount);
    }
}
