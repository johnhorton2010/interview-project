package com.platinumrelations.interview.payment_reconciliation.reconciliation.controller;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine.ReconciliationEngine;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "${app.custom.restcontroller.prefix}/reconciliations")
public class ReconciliationController {

    public ReconciliationController(ReconciliationEngine reconciliationEngine){
        this.reconciliationEngine = reconciliationEngine;
    }

    final ReconciliationEngine reconciliationEngine;

    @Operation(summary = "Kick off the reconciliation process based on existing Ledger Internal Transactions and ProcessorSettlementTransactions")
    @ApiResponse(responseCode = "200", description = "The number of new Reconciled Transactions created",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(
                            type = "integer"
                    ),
                    examples = @ExampleObject(value = "23")
            )
    )
    @PostMapping
    public ResponseEntity<Integer> reconcile(){
        return ResponseEntity.ok(reconciliationEngine.reconcile());
    }
}
