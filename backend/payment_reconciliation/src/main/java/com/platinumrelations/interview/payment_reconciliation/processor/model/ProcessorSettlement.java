package com.platinumrelations.interview.payment_reconciliation.processor.model;

import com.platinumrelations.interview.payment_reconciliation.core.util.BigDecimalDeserializer;
import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.annotation.JsonDeserialize;
import tools.jackson.databind.annotation.JsonNaming;

import java.math.BigDecimal;
import java.time.LocalDate;

@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record ProcessorSettlement(
        @EqualsAndHashCode.Include @NotBlank(message = "The networkRef field cannot be blank.") String networkRef,
        String merchantRef,
        String merchantId,
        Short cardLast4,
        String cardType,
        @JsonDeserialize(using = BigDecimalDeserializer.class) BigDecimal settledAmount,
        @JsonDeserialize(using = BigDecimalDeserializer.class) BigDecimal interchangeFee,
        @JsonDeserialize(using = BigDecimalDeserializer.class) BigDecimal processorFee,
        String currency,
        LocalDate settlementDate) {

}
