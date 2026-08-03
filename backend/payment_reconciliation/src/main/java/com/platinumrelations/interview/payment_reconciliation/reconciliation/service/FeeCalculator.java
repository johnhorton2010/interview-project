package com.platinumrelations.interview.payment_reconciliation.reconciliation.service;

import com.platinumrelations.interview.payment_reconciliation.core.config.FeeSchedule;
import com.platinumrelations.interview.payment_reconciliation.core.model.CardType;
import com.platinumrelations.interview.payment_reconciliation.core.model.Fee;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

/**
 * Computes what a settlement should have been, according to the published fee schedule.
 *
 * <p>The arithmetic reference for the whole pipeline. Categorizers use it to establish the
 * expected figure, then classify a transaction by how the processor's reported figures differ from
 * it.
 *
 * <p>The three formulas are:
 * <pre>
 * interchange_fee  = round(gross &times; interchange.percent + interchange.flat)
 * processor_fee    = round(gross &times; markup.percent      + markup.flat)
 * expected_settled = gross &minus; interchange_fee &minus; processor_fee
 * </pre>
 *
 * <p>Each fee is rounded to the cent <em>before</em> the settled amount is derived, rather than
 * rounding once at the end. This matters: the two orderings can differ by a cent, and matching the
 * processor's own order of operations is what keeps that cent from being reported as a break.
 *
 * <p>Comparisons against reported figures go through
 * {@link #isWithinTolerance(BigDecimal, BigDecimal)} rather than exact equality. Reconstructing an
 * expected amount by a slightly different route than the source system legitimately differs by
 * sub-cent amounts, and treating those as breaks would bury the real ones.
 *
 * <p>Immutable after construction and therefore thread-safe: the schedule and tolerance are
 * captured once at startup and never change.
 *
 * @author John
 */
@Service
public class FeeCalculator {

    /**
     * Captures the fee schedule and the matching tolerance.
     *
     * <p>Package-private, as instantiation is Spring's job. The schedule's values are copied into
     * fields here rather than looked up per call, so a reconciliation run cannot observe the
     * schedule changing part-way through.
     *
     * @param feeSchedule the parsed fee schedule, already validated at startup
     * @param tolerance   the absolute amount by which a figure may differ from its expected value
     *                    and still count as matching, from {@code app.custom.tolerance.amount}
     */
    FeeCalculator(FeeSchedule feeSchedule, @Value("${app.custom.tolerance.amount}") BigDecimal tolerance) {
        feesMap = feeSchedule.interchangeFeeMap();
        processorMarkup = feeSchedule.processorMarkup();
        this.tolerance = tolerance;
    }

    /** Interchange fee per card network; unmodifiable, and complete for every known network. */
    private final Map<CardType, Fee> feesMap;
    /** The processor's markup, applied to every transaction regardless of network. */
    private final Fee processorMarkup;
    /** Absolute amount by which a figure may differ from expectation and still match. */
    private final BigDecimal tolerance;

    /**
     * Computes the interchange fee owed to the card network.
     *
     * <p>{@code interchange_fee = round(gross × interchange.percent + interchange.flat)}, rounded
     * to two decimal places with {@link RoundingMode#HALF_UP}.
     *
     * @param cardType the card network, which selects the rate; must be a network present in the
     *                 fee schedule
     * @param gross    the amount captured before fees
     * @return the interchange fee at scale 2
     * @throws NullPointerException if {@code cardType} has no entry in the fee schedule, or if
     *                              {@code gross} is {@code null}
     */
    //interchange_fee = round(gross × interchange.percent + interchange.flat)
    public BigDecimal computeInterchangeFee(CardType cardType, BigDecimal gross){
        Fee interchangeFee = feesMap.get(cardType);
        return ((gross.multiply(interchangeFee.percent())).add(interchangeFee.flat())).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Computes the interchange fee from a card network named as text.
     *
     * <p>The convenience form for callers holding a transaction straight from the database, where
     * the network is an unvalidated {@link String}. Conversion happens here, so an unrecognised
     * network fails at the point a fee is needed rather than at load time &mdash; which is what
     * allows such a row to be loaded and quarantined instead of rejecting the whole file.
     *
     * @param cardType the card network name, which must match a {@link CardType} constant exactly,
     *                 including case
     * @param gross    the amount captured before fees
     * @return the interchange fee at scale 2
     * @throws IllegalArgumentException if {@code cardType} does not name a known network
     * @throws NullPointerException     if {@code cardType} or {@code gross} is {@code null}
     */
    //interchange_fee = round(gross × interchange.percent + interchange.flat)
    public BigDecimal computeInterchangeFee(String cardType, BigDecimal gross){
        return computeInterchangeFee(CardType.valueOf(cardType), gross);
    }

    /**
     * Computes the processor's markup.
     *
     * <p>{@code processor_fee = round(gross × markup.percent + markup.flat)}, rounded to two
     * decimal places with {@link RoundingMode#HALF_UP}. Takes no card network, since the markup is
     * the same for every transaction.
     *
     * @param gross the amount captured before fees
     * @return the processor fee at scale 2
     * @throws NullPointerException if {@code gross} is {@code null}
     */
    //processor_fee   = round(gross × markup.percent      + markup.flat)
    public BigDecimal computeProcessorFee(BigDecimal gross){
        return ((gross.multiply(processorMarkup.percent())).add(processorMarkup.flat())).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Derives the settled amount implied by fees supplied by the caller.
     *
     * <p>{@code expected_settled = gross − interchange_fee − processor_fee}.
     *
     * <p>Semantically distinct from the two overloads that take a card network: those compute the
     * fees from the schedule, whereas this one accepts whatever fees it is given. Passing the
     * processor's <em>reported</em> fees answers "is the settled amount internally consistent with
     * what the processor itself claimed to deduct?", which is the test that separates a wrong
     * principal from wrong fees. A transaction failing this check has an
     * {@code AMOUNT_MISMATCH}; one that passes it but whose reported fees disagree with the
     * schedule has a {@code FEE_DISCREPANCY}.
     *
     * <p>No rounding is applied, as the inputs are already at cent scale.
     *
     * @param gross          the amount captured before fees
     * @param interchangeFee the interchange fee to deduct, typically the reported one
     * @param processorFee   the processor fee to deduct, typically the reported one
     * @return the implied settled amount, at the scale of the inputs
     * @throws NullPointerException if any argument is {@code null}
     */
    //expected_settled = gross − interchange_fee − processor_fee
    public BigDecimal computeExpectedSettlement(BigDecimal gross, BigDecimal interchangeFee, BigDecimal processorFee){
        return gross.subtract(interchangeFee).subtract(processorFee);
    }

    /**
     * Computes the settled amount the fee schedule says a transaction should have produced.
     *
     * <p>{@code expected_settled = gross − interchange_fee − processor_fee}, with both fees
     * derived from the schedule and each rounded to the cent before the subtraction. This is the
     * authoritative expectation the reported settled amount is judged against.
     *
     * @param cardType the card network, which selects the interchange rate
     * @param gross    the amount captured before fees
     * @return the expected settled amount
     * @throws NullPointerException if {@code cardType} has no entry in the fee schedule, or if
     *                              {@code gross} is {@code null}
     */
    //expected_settled = gross − interchange_fee − processor_fee
    public BigDecimal computeExpectedSettlement(CardType cardType, BigDecimal gross){
        return gross.subtract(computeInterchangeFee(cardType, gross)).subtract(computeProcessorFee(gross));
    }

    /**
     * Computes the expected settled amount from a card network named as text.
     *
     * <p>The convenience form for callers holding a transaction straight from the database, where
     * the network is an unvalidated {@link String}.
     *
     * @param cardType the card network name, which must match a {@link CardType} constant exactly,
     *                 including case
     * @param gross    the amount captured before fees
     * @return the expected settled amount
     * @throws IllegalArgumentException if {@code cardType} does not name a known network
     * @throws NullPointerException     if {@code cardType} or {@code gross} is {@code null}
     */
    //expected_settled = gross − interchange_fee − processor_fee
    public BigDecimal computeExpectedSettlement(String cardType, BigDecimal gross){
        return computeExpectedSettlement(CardType.valueOf(cardType), gross);
    }

    /**
     * Tests whether an amount is close enough to its expected value to count as matching.
     *
     * <p>The band is {@code targetAmount ± tolerance} and is <em>inclusive</em> at both ends, so a
     * difference of exactly the tolerance still matches. It exists to absorb sub-cent divergence:
     * reconstructing an expected amount by a different route than the source system can differ by
     * a cent through rounding alone, and flagging that as a break would swamp the report with
     * noise and hide the genuine discrepancies.
     *
     * <p>Comparison is by {@link BigDecimal#compareTo(BigDecimal)}, not {@code equals}, so values
     * of differing scale such as {@code 1.50} and {@code 1.5} compare as equal.
     *
     * @param providedAmount the observed figure, typically as reported by the processor
     * @param targetAmount   the figure it is expected to equal
     * @return {@code true} if the observed figure lies within the tolerance band, bounds included
     * @throws NullPointerException if either argument is {@code null}
     */
    // plus or minus a predetermined amount
    public boolean isWithinTolerance(BigDecimal providedAmount, BigDecimal targetAmount){
        BigDecimal settlementLowerbound = targetAmount.subtract(tolerance);
        BigDecimal settlementUpperbound = targetAmount.add(tolerance);

        return providedAmount.compareTo(settlementLowerbound) >= 0 && providedAmount.compareTo(settlementUpperbound) <= 0;
    }
}
