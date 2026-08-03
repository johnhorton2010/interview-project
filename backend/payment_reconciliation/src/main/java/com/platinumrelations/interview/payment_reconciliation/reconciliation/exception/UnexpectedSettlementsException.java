package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;

/**
 * Thrown when a ledger transaction reaches a coordinator with a number of matched settlements that
 * coordinator does not handle.
 *
 * <p>A pipeline invariant violation rather than a data problem. The engine routes each transaction
 * to the coordinator for its settlement count, so arriving with the wrong count means the routing
 * and the coordinator disagree. It is deliberately not silently tolerated: absorbing it would
 * leave the transaction uncategorised and quietly absent from the report.
 *
 * <p>Unlike the fee schedule and holiday failures, this occurs during a reconciliation run rather
 * than at startup, so it surfaces through the REST error handler as a
 * {@code 500 Internal Server Error}.
 *
 * @author John
 */
public class UnexpectedSettlementsException extends RuntimeException{

    /**
     * Creates the exception with no underlying cause.
     *
     * @param message identifies the transaction and the settlement count that was not expected
     */
    public UnexpectedSettlementsException(String message){
        super(message);
    }

    /**
     * Creates the exception wrapping the failure that triggered it.
     *
     * @param message identifies the transaction and the settlement count that was not expected
     * @param cause   the originating failure, retained so the full trace reaches the server log
     */
    public UnexpectedSettlementsException(String message, Throwable cause){
        super(message, cause);
    }
}
