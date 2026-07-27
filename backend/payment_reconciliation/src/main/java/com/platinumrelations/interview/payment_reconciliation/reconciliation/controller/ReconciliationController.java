package com.platinumrelations.interview.payment_reconciliation.reconciliation.controller;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine.ReconciliationEngine;
import org.springframework.http.ResponseEntity;
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

    @PostMapping
    public ResponseEntity<Integer> reconcile(){
        return ResponseEntity.ok(reconciliationEngine.reconcile());
    }
}
