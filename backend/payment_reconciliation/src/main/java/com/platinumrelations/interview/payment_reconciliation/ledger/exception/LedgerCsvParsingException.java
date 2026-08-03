package com.platinumrelations.interview.payment_reconciliation.ledger.exception;

/**
 * Thrown when an uploaded ledger CSV cannot be read or parsed.
 *
 * <p>Signals a problem with the whole file &mdash; unreadable stream, missing columns, malformed
 * structure &mdash; not with an individual cell. A single unparseable amount is absorbed by
 * {@code BigDecimalDeserializer} instead, so reaching this exception means no rows were loaded.
 *
 * <p>Unchecked so it can travel from the parser to the {@code @RestControllerAdvice} without
 * intermediate layers restating it; there it becomes a {@code 400 Bad Request}, since the file
 * rather than the service is at fault.
 *
 * @author John
 */
public class LedgerCsvParsingException extends  RuntimeException{

    /**
     * Creates the exception with no underlying cause.
     *
     * @param message description of what could not be parsed
     */
    public LedgerCsvParsingException(String message){
        super(message);
    }

    /**
     * Creates the exception wrapping the failure that triggered it.
     *
     * @param message description of what could not be parsed
     * @param cause   the originating failure, typically an {@link java.io.IOException} from the
     *                upload stream; retained so the full trace reaches the server log
     */
    public LedgerCsvParsingException(String message, Throwable cause){
        super(message,cause);
    }
}
