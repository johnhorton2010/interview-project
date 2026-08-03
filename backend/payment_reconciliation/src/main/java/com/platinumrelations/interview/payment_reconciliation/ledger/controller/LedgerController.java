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

/**
 * REST endpoints for loading and clearing the merchant's internal ledger.
 *
 * <p>Mounted under the configurable {@code app.custom.restcontroller.prefix} so the API version
 * prefix is a deployment concern rather than something compiled into each controller.
 *
 * <p>Failures are not caught here; they propagate to
 * {@code GlobalRestControllerExceptionHandler}, which maps them to the shared error payload. The
 * OpenAPI annotations describe only the success responses for that reason.
 *
 * @author John
 */
@RestController
@RequestMapping(value = "${app.custom.restcontroller.prefix}/ledger-transactions")
public class LedgerController {

    /**
     * Creates the controller.
     *
     * @param ledgerService service performing the parse-and-store work
     */
    public LedgerController(LedgerService ledgerService){
        this.ledgerService = ledgerService;
    }

    /** Service this controller delegates all ledger work to. */
    final private LedgerService ledgerService;

    /**
     * Bulk-loads ledger transactions from an uploaded CSV file.
     *
     * <p>Mapped to {@code PUT} rather than {@code POST} because the operation is idempotent: a
     * transaction already stored is reported as {@code NO_CHANGE} and left untouched, so
     * re-sending the same file has no further effect. The per-row result is returned instead of a
     * bare count so the caller can tell exactly which transactions were new.
     *
     * @param file the {@code file} part of the multipart request, a CSV with a header row
     * @return {@code 200 OK} with a map from {@code internalTxnId} to the outcome for that row
     * @throws com.platinumrelations.interview.payment_reconciliation.ledger.exception.LedgerCsvParsingException
     *         if the file cannot be parsed, surfacing as {@code 400 Bad Request}
     */
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

    /**
     * Deletes every stored ledger transaction.
     *
     * <p>Unconditional and unfiltered; provided to reset the ledger between runs against different
     * data sets. Settlements and recorded reconciliation results are not affected.
     *
     * @return {@code 200 OK} wrapping the number of transactions deleted
     */
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
