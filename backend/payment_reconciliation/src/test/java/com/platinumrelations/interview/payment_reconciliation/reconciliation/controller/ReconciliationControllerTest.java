package com.platinumrelations.interview.payment_reconciliation.reconciliation.controller;

import com.platinumrelations.interview.payment_reconciliation.core.model.CardType;
import com.platinumrelations.interview.payment_reconciliation.core.model.Currency;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.Type;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionPairing;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.ReconciliationService;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine.ReconciliationEngine;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import tools.jackson.databind.ObjectMapper;


import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@WebMvcTest(ReconciliationController.class)
public class ReconciliationControllerTest {

    ReconciliationControllerTest(@Value("${app.custom.restcontroller.prefix}") String apiRoot){
        reconciliationsUri = apiRoot + "/reconciliations";
    }

    @Autowired
    private MockMvcTester mockMvcTester;
    @MockitoBean
    ReconciliationEngine reconciliationEngine;
    @MockitoBean
    ReconciliationService reconciliationService;

    private final String reconciliationsUri;

    @Test
    void reconcile_200_whenHappyPath() {
        when(reconciliationEngine.reconcile()).thenReturn(1);

        assertThat(mockMvcTester.post().uri(reconciliationsUri))
                .hasStatusOk()
                .hasContentType(MediaType.APPLICATION_JSON)
                .bodyJson()
                .isStrictlyEqualTo("1");
    }

    @Test
    void retrieveAllReconciledTransactions_200_whenHappyPath() {
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        HashMap<ProcessorSettlement, Set<InternalTransaction>> psToItMap = new HashMap<>();
        HashMap<String, TransactionPairing> orderRefToTransactionKeysMap = new HashMap<>();

        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("TXN-000002")
                .merchantId("MERCH-006")
                .merchantRef("ORD-006-29772")
                .cardType(CardType.MASTERCARD.name())
                .cardLast4("1241")
                .grossAmount(new BigDecimal("351.60"))
                .currency(Currency.USD.name())
                .type(Type.SALE.name())
                .capturedAt(LocalDate.of(2026, 6, 6).atStartOfDay(ZoneId.of("UTC")).toInstant())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ARN74000000000000048583")
                .merchantRef("ORD-006-29772")
                .merchantId("MERCH-006")
                .cardLast4("1241")
                .cardType(CardType.MASTERCARD.name())
                .settledAmount(new BigDecimal("343.72"))
                .interchangeFee(new BigDecimal("6.78"))
                .processorFee(new BigDecimal("1.10"))
                .currency(Currency.USD.name())
                .settlementDate(LocalDate.of(2026,6,8))
                .build();

        TransactionPairing transactionPairing = new TransactionPairing();
        transactionPairing.getInternalTransactions().add(it);
        transactionPairing.getProcessorSettlements().add(ps);

        itToPsMap.put(it, new HashSet<>(List.of(ps)));
        psToItMap.put(ps, new HashSet<>(List.of(it)));
        orderRefToTransactionKeysMap.put(it.merchantRef(), transactionPairing);

        TransactionMapping transactionMapping = new TransactionMapping(itToPsMap, psToItMap, orderRefToTransactionKeysMap);

        when(reconciliationService.retrieveAllReconciledTransactions()).thenReturn(transactionMapping);

        assertThat(mockMvcTester.get().uri(reconciliationsUri))
                .hasStatusOk()
                .hasContentType(MediaType.APPLICATION_JSON)
                .bodyJson()
                .isStrictlyEqualTo("""
                        {
                          "internalTransactionToProcessorSettlementsMap" : {
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
                              "settlement_date" : "2026-06-08"
                            } ]
                          },
                          "processorSettlementToIternalTransactionsMap" : {
                            "ARN74000000000000048583" : [ {
                              "internal_txn_id" : "TXN-000002",
                              "merchant_id" : "MERCH-006",
                              "merchant_ref" : "ORD-006-29772",
                              "card_type" : "MASTERCARD",
                              "card_last4" : "1241",
                              "gross_amount" : 351.6,
                              "currency" : "USD",
                              "type" : "SALE",
                              "captured_at" : "2026-06-06T00:00:00Z"
                            } ]
                          },
                          "merchantRefToTransactionKeysMap" : {
                            "ORD-006-29772" : {
                              "internalTransactions" : [ "TXN-000002" ],
                              "processorSettlements" : [ "ARN74000000000000048583" ]
                            }
                          }
                        }
                        """);
    }
}
