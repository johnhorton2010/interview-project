package com.platinumrelations.interview.payment_reconciliation.reconciliation.model;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.EqualsAndHashCode;

/**
 * The verdict recorded against one ledger transaction paired with one processor settlement.
 *
 * <p>Corresponds to a row of {@code reconciled_transactions}, which is the only place a
 * reconciliation outcome is persisted; neither the {@code ledger} nor the
 * {@code processor_settlement} table is ever written to by the pipeline. That separation is what
 * lets reconciliation be re-run from scratch without having mutated its own inputs.
 *
 * <p>The pair of identifiers is the natural key. Because a single ledger transaction may pair with
 * several settlements &mdash; the {@link Category#SPLIT} and {@link Category#DUPLICATE} cases
 * &mdash; neither identifier alone identifies a row.
 *
 * <p>Being a record, equality covers all three components including {@code category}, so two
 * verdicts for the same pair are unequal while the category differs.
 *
 * @param internalTxnId identifier of the ledger side of the pairing; must not be blank
 * @param networkRef    identifier of the settlement side of the pairing; must not be blank
 * @param category      the outcome, holding the name of a {@link Category} constant. Held as a
 *                      {@link String} rather than the enum so a value read back from a database
 *                      written by an older or newer version does not fail to map.
 * @author John
 */
@Builder
public record ReconciledTransaction(

        @NotBlank(message = "The internalTxnId field cannot be blank.") String internalTxnId,
        @NotBlank(message = "The networkRef field cannot be blank.") String networkRef,
        String category) {

}
