package com.platinumrelations.interview.payment_reconciliation.reconciliation.model;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.EqualsAndHashCode;

@Builder
public record ReconciledTransaction(

        @EqualsAndHashCode.Include @NotBlank(message = "The internalTxnId field cannot be blank.") String internalTxnId,
        @EqualsAndHashCode.Include @NotBlank(message = "The networkRef field cannot be blank.") String networkRef,
        String category) {

}
