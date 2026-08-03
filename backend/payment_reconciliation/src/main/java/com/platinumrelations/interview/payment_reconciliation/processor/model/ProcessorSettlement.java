package com.platinumrelations.interview.payment_reconciliation.processor.model;

import com.platinumrelations.interview.payment_reconciliation.core.util.BigDecimalDeserializer;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import tools.jackson.databind.annotation.JsonDeserialize;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One settlement line as reported by the payment processor &mdash; the "external" side of a
 * reconciliation.
 *
 * <p>The counterpart to {@code InternalTransaction}: that type records what the merchant believes
 * happened, this one records what the processor says actually happened, and the whole
 * reconciliation pipeline exists to explain any difference.
 *
 * <p>Immutable via Lombok's {@code @Value}, so instances are safe to share across threads and to
 * use as keys in the maps and sets the pipeline builds.
 *
 * <p>Equality is narrowed to {@code networkRef} alone. Note that duplicate detection deliberately
 * uses a different notion of sameness &mdash; see
 * {@code ProcessorSettlementComparator#compareWithoutNetworkRefAndCategory} &mdash; because the
 * defining trait of a duplicated settlement is that it carries a <em>different</em> network
 * reference for the same economic event.
 *
 * <p>Both the fees and the settled amount are reported by the processor and are treated as
 * claims, not facts: reconciliation recomputes them from the fee schedule and classifies the
 * transaction by how the reported and expected figures differ.
 *
 * @author John
 */
@Value
@Builder
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class ProcessorSettlement{
        /**
         * The processor's unique reference for this settlement; the sole component of equality and
         * the key of the {@code processor_settlement} table. Must not be blank.
         */
        @EqualsAndHashCode.Include
        @NotBlank(message = "The networkRef field cannot be blank.")
        String networkRef;
        /**
         * Reference echoed back from the merchant's own record; the primary matching key. May be
         * {@code null} or blank, which is precisely the case the fallback matching pass exists to
         * handle.
         */
        String merchantRef;
        /** Identifies the merchant; combined with card details to match when {@code merchantRef} is absent. */
        String merchantId;
        /** Last four digits of the card, used as a fallback matching signal. */
        String cardLast4;
        /** Card network as reported; parsed into {@code CardType} only when a fee is recomputed. */
        String cardType;
        /**
         * Net amount the processor settled, after its reported fees. Signed: positive for a sale
         * and negative for a refund, which is how matching enforces that a sale cannot pair with a
         * refund. Deserialized leniently, so a malformed value becomes zero rather than failing
         * the request.
         */
        @JsonDeserialize(using = BigDecimalDeserializer.class)
        BigDecimal settledAmount;
        /**
         * Interchange fee as reported by the processor. Compared against the amount recomputed
         * from the fee schedule; a difference here is a fee discrepancy rather than a principal
         * error.
         */
        @JsonDeserialize(using = BigDecimalDeserializer.class)
        BigDecimal interchangeFee;
        /** Processor markup as reported, checked against the schedule in the same way as the interchange fee. */
        @JsonDeserialize(using = BigDecimalDeserializer.class)
        BigDecimal processorFee;
        /** ISO currency code as reported; amounts are never converted between currencies. */
        String currency;
        /**
         * Date the processor settled the funds. Measured against the ledger capture date to decide
         * whether the settlement landed inside the expected business-day window.
         */
        LocalDate settlementDate;
        /**
         * Reconciliation outcome for this settlement, or {@code null} on a freshly received row.
         * Not accepted from the request payload and not written by the upsert &mdash; it is
         * populated only when the row is read back joined against {@code reconciled_transactions}.
         */
        String category;
}
