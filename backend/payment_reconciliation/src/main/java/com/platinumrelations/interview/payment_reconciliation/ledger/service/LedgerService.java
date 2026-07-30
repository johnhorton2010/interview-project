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

@Slf4j
@Validated
@Service
public class LedgerService {

    public LedgerService(LedgerRepository ledgerRepository){
        this.ledgerRepository = ledgerRepository;
    }

    private final LedgerRepository ledgerRepository;

    public Map<String, RowStatus> bulkCreateLedgerInternalTransactions(MultipartFile file){
        List<InternalTransaction> internalTransactions = parseCsv(file);
        return ledgerRepository.saveAll(internalTransactions);
    }

    private @Valid List<InternalTransaction> parseCsv(MultipartFile file) {
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

    public int removeAllExistingInternalTransactions(){
        return ledgerRepository.deleteAll();
    }
}
