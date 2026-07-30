package com.platinumrelations.interview.payment_reconciliation.ledger.controller;

import com.platinumrelations.interview.payment_reconciliation.core.model.RecordCount;
import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.ledger.service.LedgerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Encoding;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping(value = "${app.custom.restcontroller.prefix}/ledger-transactions")
public class LedgerController {

    public LedgerController(LedgerService ledgerService){
        this.ledgerService = ledgerService;
    }

    final private LedgerService ledgerService;

    @Operation(summary = "Attempt to create Ledger Internal Transactions")
    @ApiResponse(responseCode = "200", description = "Created a new Ledger Internal Transaction or no change if an individual transaction already exists",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(
                            type = "object",
                            example =
                                """
                                {
                                  "TXN-000012" : "INSERTED_OR_UPDATED",
                                  "TXN-000083" : "NO_CHANGE"
                                }
                                """
                    )
            )
    )
    @PutMapping(consumes = "multipart/form-data")
    public ResponseEntity<Map<String, RowStatus>> bulkCreateLedgerInternalTransactions(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "A CSV file containing Ledger Internal Transactions to create", required = true,
                    content = @Content(
                            mediaType = MediaType.MULTIPART_FORM_DATA_VALUE,
                        schema = @Schema(type = "object", implementation = MultipartFile.class),
                        encoding = @Encoding(name = "file", contentType = "text/csv")
                    )
            )
            @RequestPart("file")MultipartFile file){
        return ResponseEntity.ok(ledgerService.bulkCreateLedgerInternalTransactions(file));
    }

    @Operation(summary = "Deletes all existing Ledger Transactions")
    @ApiResponse(responseCode = "200", description = "An object representing the number of Ledger Transactions deleted",
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
    public ResponseEntity<RecordCount> deleteAllLedgerTransactions(){
        RecordCount recordCount = new RecordCount(ledgerService.removeAllExistingInternalTransactions());
        return ResponseEntity.ok(recordCount);
    }
}
