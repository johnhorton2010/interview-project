package com.platinumrelations.interview.payment_reconciliation.processor.model;

import com.platinumrelations.interview.payment_reconciliation.core.util.BigDecimalDeserializer;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.annotation.JsonDeserialize;
import tools.jackson.databind.annotation.JsonNaming;

import java.math.BigDecimal;
import java.time.LocalDate;

@Value
@Builder
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProcessorSettlement{
        @EqualsAndHashCode.Include
        @NotBlank(message = "The networkRef field cannot be blank.")
        String networkRef;
        String merchantRef;
        String merchantId;
        String cardLast4;
        String cardType;
        @JsonDeserialize(using = BigDecimalDeserializer.class)
        BigDecimal settledAmount;
        @JsonDeserialize(using = BigDecimalDeserializer.class)
        BigDecimal interchangeFee;
        @JsonDeserialize(using = BigDecimalDeserializer.class)
        BigDecimal processorFee;
        String currency;
        LocalDate settlementDate;
        @Schema(accessMode = Schema.AccessMode.READ_ONLY)
        String category;
}
