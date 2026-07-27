package com.platinumrelations.interview.payment_reconciliation.ledger.controller;

import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.ledger.service.LedgerService;
import org.junit.jupiter.api.MediaType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import java.util.HashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@WebMvcTest(LedgerController.class)
public class LedgerControllerTest {

    LedgerControllerTest(@Value("${app.custom.restcontroller.prefix}") String apiRoot){
        this.ledgerTransactionsUri = apiRoot + "/ledger-transactions";
    }

    @Autowired
    private MockMvcTester mockMvcTester;

    @MockitoBean
    private LedgerService ledgerService;

    private final String ledgerTransactionsUri;

    @Test
    void bulkCreateLedgerInternalTransactions_200_whenHappyPath() {
        String content = """
                internal_txn_id,merchant_id,merchant_ref,card_type,card_last4,gross_amount,currency,type,captured_at
                TXN-000012,MERCH-008,ORD-008-17602,VISA,4143,234.65,USD,SALE,2026-06-03T12:00:00Z
                """;

        MockMultipartFile mockMultipartFile = new MockMultipartFile(
                "file",
                "internal_transactions.csv",
                MediaType.TEXT_PLAIN.toString(),
                content.getBytes()
        );

        String responseJson = """
                {
                  "TXN-000012" : "INSERTED_OR_UPDATED"
                }
                """;

        HashMap<String, RowStatus> expectedResult = new HashMap<>();
        expectedResult.put("TXN-000012", RowStatus.INSERTED_OR_UPDATED);

        when(ledgerService.bulkCreateLedgerInternalTransactions(any())).thenReturn(expectedResult);

        assertThat(mockMvcTester.put().uri(ledgerTransactionsUri).multipart().file(mockMultipartFile))
                .hasStatusOk()
                .hasContentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .bodyJson()
                .isStrictlyEqualTo(responseJson);
    }
}
