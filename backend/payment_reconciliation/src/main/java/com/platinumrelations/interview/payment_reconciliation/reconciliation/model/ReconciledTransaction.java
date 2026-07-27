package com.platinumrelations.interview.payment_reconciliation.reconciliation.model;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.annotation.JsonNaming;


@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record ReconciledTransaction(
        @EqualsAndHashCode.Include @NotBlank(message = "The internalTxnId field cannot be blank.") String internalTxnId,
        @EqualsAndHashCode.Include @NotBlank(message = "The networkRef field cannot be blank.") String networkRef,
        String category) {

}
