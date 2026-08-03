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

/**
 * REST endpoints for running reconciliation and reading its results.
 *
 * <p>Depends on two collaborators rather than one, which reflects a deliberate split: the engine
 * produces verdicts and the service reads them back. Running and reporting are therefore separate
 * calls, so fetching a report can never set a run in motion.
 *
 * <p>Assumes both the ledger and the settlement feed have already been loaded through their own
 * endpoints; reconciliation reads whatever is present and does not ingest anything itself.
 *
 * <p>Mounted under the configurable {@code app.custom.restcontroller.prefix}. Failures propagate
 * to {@code GlobalRestControllerExceptionHandler}.
 *
 * @author John
 */
@RestController
@RequestMapping(value = "${app.custom.restcontroller.prefix}/reconciliations")
public class ReconciliationController {

    /**
     * Creates the controller.
     *
     * @param reconciliationEngine  runs the categorization pipeline
     * @param reconciliationService reads and clears recorded results
     */
    public ReconciliationController(ReconciliationEngine reconciliationEngine, ReconciliationService reconciliationService){
        this.reconciliationEngine = reconciliationEngine;
        this.reconciliationService = reconciliationService;
    }

    /** Runs the categorization pipeline; used only by the run endpoint. */
    final ReconciliationEngine reconciliationEngine;
    /** Reads and clears recorded results; used by the report and delete endpoints. */
    final ReconciliationService reconciliationService;

    /**
     * Runs the reconciliation pipeline over the currently loaded data.
     *
     * <p>Mapped to {@code POST} because it is not idempotent in the usual sense: it does work
     * whose result depends on what is already recorded. Re-running is safe &mdash; verdicts
     * already reached are not overwritten &mdash; but a second call typically reports a smaller
     * count, since only newly decidable pairings remain. The count is therefore a measure of what
     * this call changed, not of how many transactions exist.
     *
     * <p>Runs synchronously and within a single transaction, so a failure part-way leaves the
     * verdict table as it was rather than half-judged.
     *
     * @return {@code 200 OK} wrapping the number of reconciled transactions this run created or
     *         re-categorized
     * @throws com.platinumrelations.interview.payment_reconciliation.reconciliation.exception.UnexpectedSettlementsException
     *         if a transaction reaches a coordinator with a settlement count it does not handle,
     *         surfacing as {@code 500 Internal Server Error} with the whole run rolled back
     */
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

    /**
     * Returns every finished verdict, with both sides of each pairing.
     *
     * <p>The reporting endpoint. The payload carries the same data indexed three ways &mdash; by
     * ledger transaction, by settlement, and by merchant reference &mdash; so a consumer can drill
     * down from either side or view a whole order at once without re-querying. Within the two
     * keyed views the opposite side appears as identifiers only, since the full objects are
     * already present in the other view.
     *
     * <p>Pairings still in progress are excluded, so this reports a settled picture. Returns an
     * empty structure rather than an error when no run has completed.
     *
     * @return {@code 200 OK} with the three indexed views of every finished verdict
     */
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

    /**
     * Discards every recorded verdict.
     *
     * <p>Clears only reconciliation's own results; the ledger and settlement data survive. That is
     * what makes this the way to re-reconcile from scratch after changing the fee schedule or the
     * matching rules &mdash; delete the verdicts, then run again against unchanged inputs.
     *
     * @return {@code 200 OK} wrapping the number of verdicts deleted
     */
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
