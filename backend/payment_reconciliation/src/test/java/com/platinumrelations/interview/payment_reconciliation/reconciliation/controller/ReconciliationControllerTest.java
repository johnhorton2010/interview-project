package com.platinumrelations.interview.payment_reconciliation.reconciliation.controller;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine.ReconciliationEngine;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;


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
}
