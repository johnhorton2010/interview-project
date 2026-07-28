package com.platinumrelations.interview.payment_reconciliation.ledger.model;

import com.platinumrelations.interview.payment_reconciliation.core.util.BigDecimalDeserializer;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Value;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.annotation.JsonDeserialize;
import tools.jackson.databind.annotation.JsonNaming;


import java.math.BigDecimal;
import java.time.Instant;

@Value
@Builder
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InternalTransaction{
        @EqualsAndHashCode.Include
        @NotBlank(message = "The internalTxnId field cannot be blank.")
        String internalTxnId;
        String merchantId;
        String merchantRef;
        String cardType;
        String cardLast4;
        @JsonDeserialize(using = BigDecimalDeserializer.class)
        BigDecimal grossAmount;
        String currency;
        String type;
        Instant capturedAt;
        String category;
}
