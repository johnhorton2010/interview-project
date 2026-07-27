package com.platinumrelations.interview.payment_reconciliation.ledger.model;

import com.fasterxml.jackson.annotation.JsonKey;
import com.platinumrelations.interview.payment_reconciliation.core.util.BigDecimalDeserializer;
import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.annotation.JsonDeserialize;
import tools.jackson.databind.annotation.JsonNaming;


import java.math.BigDecimal;
import java.time.Instant;

@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record InternalTransaction(
        @JsonKey
        @EqualsAndHashCode.Include
        @NotBlank(message = "The internalTxnId field cannot be blank.")
        String internalTxnId,
        String merchantId,
        String merchantRef,
        String cardType,
        String cardLast4,
        @JsonDeserialize(using = BigDecimalDeserializer.class) BigDecimal grossAmount,
        String currency,
        String type,
        Instant capturedAt) {

}
