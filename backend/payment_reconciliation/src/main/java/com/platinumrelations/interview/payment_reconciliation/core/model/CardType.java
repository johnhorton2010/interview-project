package com.platinumrelations.interview.payment_reconciliation.core.model;

/**
 * Card networks recognised by the fee schedule.
 *
 * <p>Each constant must have a matching key under the {@code interchange} object of
 * {@code fee_schedule.json}; the interchange map is built by calling {@link #valueOf(String)} on
 * those keys, so an unknown network in the file fails at startup and an unknown network on an
 * inbound row fails when its fee is computed.
 *
 * @author John
 */
public enum CardType {
    VISA,
    MASTERCARD,
    AMEX,
    DISCOVER
}
