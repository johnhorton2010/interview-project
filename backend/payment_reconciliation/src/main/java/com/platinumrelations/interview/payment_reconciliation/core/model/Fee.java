package com.platinumrelations.interview.payment_reconciliation.core.model;

import java.math.BigDecimal;

/**
 * A two-part fee expressed as a rate plus a fixed component.
 *
 * <p>Applied as {@code round(gross * percent + flat)} at scale 2 with
 * {@link java.math.RoundingMode#HALF_UP}. Used for both the per-network interchange fee and the
 * processor markup, both of which are read from {@code fee_schedule.json} at startup.
 *
 * <p>Instances are immutable and safe to share across threads, and are held for the lifetime of
 * the application in the fee schedule beans.
 *
 * @param percent the proportional rate as a decimal fraction, not a percentage &mdash; {@code 0.018}
 *                means 1.8%. Never {@code null}.
 * @param flat    the fixed per-transaction component in the transaction's currency. Never {@code null}.
 * @author John
 */
public record Fee (BigDecimal percent, BigDecimal flat) {}
