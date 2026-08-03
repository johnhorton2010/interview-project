package com.platinumrelations.interview.payment_reconciliation.ledger.model;

import com.platinumrelations.interview.payment_reconciliation.core.util.BigDecimalDeserializer;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Value;
import tools.jackson.databind.annotation.JsonDeserialize;


import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * One transaction as recorded by the merchant's own ledger &mdash; the "internal" side of a
 * reconciliation.
 *
 * <p>Immutable: Lombok's {@code @Value} makes every field private and final and generates only
 * getters, so instances are safe to share across threads and to use as keys in the maps and sets
 * the reconciliation pipeline builds.
 *
 * <p>Equality is deliberately narrowed to {@code internalTxnId} alone via
 * {@code @EqualsAndHashCode(onlyExplicitlyIncluded = true)}. That identity is what makes
 * {@code Set<InternalTransaction>} de-duplicate correctly when the same ledger row is reached
 * through several different settlement joins; full-field equality would let one logical
 * transaction appear repeatedly because unmatched columns differ between query shapes.
 *
 * <p>Free-text fields are typed as {@link String} rather than as enums because inbound CSV data is
 * untrusted: an unrecognised {@code cardType} or {@code type} must survive loading so it can be
 * quarantined later, whereas an enum would fail the whole upload at parse time. Conversion to
 * {@code CardType} and {@code Type} happens downstream, where failure is meaningful.
 *
 * @author John
 */
@Value
@Builder
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class InternalTransaction{
        /**
         * The merchant's unique identifier for this transaction; the sole component of equality
         * and the key of the {@code ledger} table. Must not be blank.
         */
        @EqualsAndHashCode.Include
        @NotBlank(message = "The internalTxnId field cannot be blank.")
        String internalTxnId;
        /** Identifies the merchant; combined with card details to match settlements lacking a reference. */
        String merchantId;
        /** Shared reference the processor is expected to echo back; the primary matching key when present. */
        String merchantRef;
        /** Card network as written by the source system; parsed into {@code CardType} only when a fee is computed. */
        String cardType;
        /** Last four digits of the card, used as a fallback matching signal when {@code merchantRef} is absent. */
        String cardLast4;
        /**
         * Amount captured before any fees. Deserialized leniently, so a malformed source cell
         * becomes zero rather than failing the upload.
         */
        @JsonDeserialize(using = BigDecimalDeserializer.class)
        BigDecimal grossAmount;
        /** ISO currency code as written by the source system; amounts are never converted between currencies. */
        String currency;
        /** {@code SALE} or {@code REFUND} as written by the source system; fixes the expected sign of the settlement. */
        String type;
        /** When the merchant captured the transaction; the start of the settlement window. */
        OffsetDateTime capturedAt;
        /**
         * Reconciliation outcome for this transaction, or {@code null} on a freshly parsed row.
         * Not part of the CSV schema and not written by the ledger upsert &mdash; it is populated
         * only when the row is read back joined against {@code reconciled_transactions}.
         */
        String category;
}
