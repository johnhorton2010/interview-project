package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;

/**
 * Thrown when an entry in the configured {@code app.custom.holidays} list is not a parseable date.
 *
 * <p>A startup failure by design, for the same reason as a bad fee schedule: holidays determine
 * which days count towards the settlement window, so an unparseable entry would silently widen or
 * narrow that window and mis-categorise timing for every transaction. Failing at startup makes the
 * misconfiguration visible instead.
 *
 * <p>Unchecked, so it can propagate out of bean construction without appearing on signatures
 * Spring invokes reflectively.
 *
 * @author John
 */
public class HolidayDateParsingException extends RuntimeException{

    /**
     * Creates the exception with no underlying cause.
     *
     * @param message names the offending date string
     */
    public HolidayDateParsingException(String message){
        super(message);
    }

    /**
     * Creates the exception wrapping the failure that triggered it.
     *
     * @param message names the offending date string
     * @param cause   the originating parse failure, retained so the full trace reaches the startup log
     */
    public HolidayDateParsingException(String message, Throwable cause){
        super(message, cause);
    }
}
