package com.platinumrelations.interview.payment_reconciliation.processor.controller;

import com.platinumrelations.interview.payment_reconciliation.core.model.CardType;
import com.platinumrelations.interview.payment_reconciliation.core.model.Currency;
import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.processor.service.ProcessorSettlementService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;


@WebMvcTest(ProcessorSettlementController.class)
public class ProcessorSettlementControllerTest {

    ProcessorSettlementControllerTest(@Value("${app.custom.restcontroller.prefix}") String apiRoot){
            this.psTransactionsUri = apiRoot + "/processor-settlement-transactions";
    }

    @Autowired
    private MockMvcTester mockMvcTester;

    @MockitoBean
    private ProcessorSettlementService processorSettlementService;

    private final String psTransactionsUri;

    @Test
    void bulkCreateProcessorSettlements_200_whenHappyPath() {
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ARN74000000000000075752")
                .merchantRef("ORD-002-88193")
                .merchantId("MERCH-002")
                .cardLast4("6408")
                .cardType(CardType.AMEX.name())
                .settledAmount(new BigDecimal("606.29"))
                .interchangeFee(new BigDecimal("19.85"))
                .interchangeFee(new BigDecimal("1.93"))
                .processorFee(new BigDecimal("1.93"))
                .currency(Currency.USD.name())
                .settlementDate(LocalDate.of(2026, 6,3))
                .build();

        String requestJson = """
                [
                {
                  "network_ref" : "ARN74000000000000075752",
                  "merchant_ref" : "ORD-002-88193",
                  "merchant_id" : "MERCH-002",
                  "card_last4" : 6408,
                  "card_type" : "AMEX",
                  "settled_amount" : 606.29,
                  "interchange_fee" : 1.93,
                  "processor_fee" : 1.93,
                  "currency" : "USD",
                  "settlement_date" : "2026-06-03"
                }
                ]
                """;

        String responseJson = """
                {
                  "ARN74000000000000075752" : "INSERTED_OR_UPDATED"
                }
                """;

        HashMap<String, RowStatus> expectedResult = new HashMap<>();
        expectedResult.put(ps.networkRef(), RowStatus.INSERTED_OR_UPDATED);

        when(processorSettlementService.bulkCreateProcessorSettlements(any())).thenReturn(expectedResult);

        assertThat(mockMvcTester.put().uri(psTransactionsUri).contentType(MediaType.APPLICATION_JSON).content(requestJson))
                .hasStatusOk()
                .hasContentType(MediaType.APPLICATION_JSON)
                .bodyJson()
                .isStrictlyEqualTo(responseJson);
    }

    @Test
    void bulkCreateProcessorSettlements_400_whenNoNetworkRefKey() {

        String requestJson = """
                [
                {
                  "merchant_ref" : "ORD-002-88193",
                  "merchant_id" : "MERCH-002",
                  "card_last4" : 6408,
                  "card_type" : "AMEX",
                  "settled_amount" : 606.29,
                  "interchange_fee" : 1.93,
                  "processor_fee" : 1.93,
                  "currency" : "USD",
                  "settlement_date" : "2026-06-03"
                }
                ]
                """;

        assertThat(mockMvcTester.put().uri(psTransactionsUri).contentType(MediaType.APPLICATION_JSON).content(requestJson))
                .hasStatus4xxClientError()
                .hasContentType(MediaType.APPLICATION_JSON);
    }
}
