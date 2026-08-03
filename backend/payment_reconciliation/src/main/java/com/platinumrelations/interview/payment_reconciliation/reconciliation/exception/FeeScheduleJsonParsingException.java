package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;

/**
 * Thrown when {@code fee_schedule.json} cannot be read or does not have the expected structure.
 *
 * <p>A startup failure by design. The schedule defines what every settlement should have been, so
 * reconciling without it in full would mis-classify every transaction rather than fail visibly;
 * refusing to start is the safer outcome. {@code FeeScheduleFailureAnalyzer} turns the resulting
 * context failure into an actionable message.
 *
 * <p>Unchecked, so the bean methods that build the schedule need not declare it on signatures
 * Spring calls reflectively.
 *
 * @author John
 */
public class FeeScheduleJsonParsingException extends RuntimeException{

    /**
     * Creates the exception with no underlying cause.
     *
     * @param message names the key or value in the schedule that could not be read
     */
    public FeeScheduleJsonParsingException(String message){
        super(message);
    }

    /**
     * Creates the exception wrapping the failure that triggered it.
     *
     * @param message names the key or value in the schedule that could not be read
     * @param cause   the originating failure, retained so the full trace reaches the startup log
     */
    public FeeScheduleJsonParsingException(String message, Throwable cause){
        super(message, cause);
    }
}
