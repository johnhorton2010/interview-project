package com.platinumrelations.interview.payment_reconciliation.ledger.service;

import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.ledger.exception.LedgerCsvParsingException;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.ledger.repository.LedgerRepository;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.dataformat.csv.CsvMapper;
import tools.jackson.dataformat.csv.CsvSchema;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;

/**
 * Turns uploaded ledger CSV files into stored {@link InternalTransaction} rows.
 *
 * <p>{@code @Validated} enables method-level bean validation, which is what makes the
 * {@code @Valid} element constraint on the parsed list take effect; a row with a blank
 * {@code internalTxnId} is rejected before it can reach the database, where it would be
 * unaddressable.
 *
 * <p>Parsing and persistence are kept in one step deliberately: the whole file is materialised and
 * then written as a single batch, so a file that fails to parse never leaves a partial load
 * behind.
 *
 * @author John
 */
@Slf4j
@Validated
@Service
public class LedgerService {

    /**
     * Creates the service.
     *
     * @param ledgerRepository data access for the {@code ledger} table
     */
    public LedgerService(LedgerRepository ledgerRepository){
        this.ledgerRepository = ledgerRepository;
    }

    /** Data access for the {@code ledger} table. */
    private final LedgerRepository ledgerRepository;

    /**
     * Parses an uploaded CSV and stores every transaction it contains.
     *
     * <p>Idempotent: a transaction already present is reported as unchanged rather than
     * overwritten, so re-uploading the same file is safe.
     *
     * @param file the uploaded CSV; must carry a header row naming the expected columns
     * @return a map from {@code internalTxnId} to whether that row was written or already present
     * @throws LedgerCsvParsingException if the file cannot be read or parsed, in which case
     *                                   nothing is stored
     * @throws jakarta.validation.ConstraintViolationException if any parsed row violates a field
     *                                   constraint, such as a blank identifier
     */
    public Map<String, RowStatus> bulkCreateLedgerInternalTransactions(MultipartFile file){
        List<InternalTransaction> internalTransactions = parseCsv(file);
        return ledgerRepository.saveAll(internalTransactions);
    }

    /**
     * Reads the upload into transactions using an explicit column schema.
     *
     * <p>The schema is declared column by column rather than inferred so that an unexpected header
     * is a detectable error instead of a silently ignored column. Column reordering is enabled, so
     * the file's header decides position and the columns may appear in any order; snake_case
     * headers are mapped onto camelCase fields by the naming strategy.
     *
     * <p>The whole file is read into memory at once. That bounds this endpoint to files that fit
     * in heap, which is acceptable for the reconciliation batch sizes involved and is what allows
     * the subsequent write to be a single atomic batch.
     *
     * @param file the uploaded CSV
     * @return every parsed transaction, in file order; empty if the file has only a header
     * @throws LedgerCsvParsingException if the stream cannot be opened or the content cannot be
     *                                   parsed against the schema
     */
    private List<@Valid InternalTransaction> parseCsv(MultipartFile file) {
            CsvSchema schema = CsvSchema
                    .builder()
                    .addColumn("internal_txn_id")
                    .addColumn("merchant_id")
                    .addColumn("merchant_ref")
                    .addColumn("card_type")
                    .addColumn("card_last4")
                    .addColumn("gross_amount")
                    .addColumn("currency")
                    .addColumn("type")
                    .addColumn("captured_at")
                    .setUseHeader(true)
                    .build()
                    .withColumnReordering(true);

            CsvMapper csvMapper = CsvMapper.builder().propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE).build();

        try (InputStream fileInputStream = file.getInputStream()){
            return csvMapper.readerFor(InternalTransaction.class).with(schema).<InternalTransaction>readValues(fileInputStream).readAll();
        } catch (IOException ex) {
            String message = "Failed to parse the csv file representing the processor settlements.";
            throw new LedgerCsvParsingException(message, ex);
        }
    }

    /**
     * Deletes every stored ledger transaction.
     *
     * @return the number of transactions deleted; zero if the ledger was already empty
     * @throws org.springframework.dao.DataAccessException if the delete fails
     */
    public int removeAllExistingInternalTransactions(){
        return ledgerRepository.deleteAll();
    }
}
