package com.platinumrelations.interview.payment_reconciliation.ledger.controller;

import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.ledger.service.LedgerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping(value = "${app.custom.restcontroller.prefix}/ledger-transactions")
public class LedgerController {

    public LedgerController(LedgerService ledgerService){
        this.ledgerService = ledgerService;
    }

    final private LedgerService ledgerService;

    @PutMapping(consumes = "multipart/form-data")
    public ResponseEntity<Map<String, RowStatus>> bulkCreateLedgerInternalTransactions(@RequestPart("file")MultipartFile file){
        return ResponseEntity.ok(ledgerService.bulkCreateLedgerInternalTransactions(file));
    }
}
