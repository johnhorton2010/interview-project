package com.platinumrelations.interview.payment_reconciliation.core.exception;

import com.platinumrelations.interview.payment_reconciliation.ledger.exception.LedgerCsvParsingException;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.exception.UnexpectedSettlementsException;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

/**
 * Translates exceptions escaping any REST controller into a uniform {@link ErrorResponse}.
 *
 * <p>Split along a single line: a failure caused by what the caller sent is a {@code 400}, and a
 * failure of the service itself is a {@code 500}. Every handler logs the exception with its stack
 * trace at {@code ERROR} and then returns a sanitised message, so the caller learns what to fix
 * without the response ever carrying internal detail.
 *
 * <p>Handlers are selected most-specific-first by Spring, so {@link #handleAll(Exception)} only
 * runs for exceptions no other method claims. It exists to guarantee that no raw stack trace or
 * container default error page can ever reach a client.
 *
 * <p>Startup failures are deliberately out of scope here; they never reach a controller and are
 * handled by the {@code AbstractFailureAnalyzer} implementations instead.
 *
 * @author John
 */
@Slf4j
@RestControllerAdvice
public class GlobalRestControllerExceptionHandler {

    /**
     * Handles a malformed or unreadable CSV upload.
     *
     * <p>Treated as a client error because the uploaded file, not the service, is at fault.
     *
     * @param ledgerCsvParsingException the parse failure, logged in full server-side
     * @return a {@code 400 Bad Request} carrying a generic parse-failure message; the offending
     *         line and column are intentionally not echoed back
     */
    @ExceptionHandler(LedgerCsvParsingException.class)
    public ResponseEntity<ErrorResponse> handleLedgerCsvParsingException(LedgerCsvParsingException ledgerCsvParsingException){
        log.error("A LedgerCsvParsingException has occurred.", ledgerCsvParsingException);

        ErrorResponse errorResponse = new ErrorResponse(
                "The CSV file was not able to be parsed.",
                Instant.now()
        );

        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

    /**
     * Handles a ledger transaction that reached reconciliation with an unexpected number of
     * matching processor settlements.
     *
     * <p>Classed as a server error rather than a client error: the coordinator that raises it has
     * already narrowed the transaction to a case it claims to handle, so arriving here means the
     * pipeline's own routing is inconsistent and the data needs investigating, not resubmitting.
     *
     * @param unexpectedSettlementsException the pipeline invariant violation, logged in full
     * @return a {@code 500 Internal Server Error} describing the mismatch in general terms
     */
    @ExceptionHandler(UnexpectedSettlementsException.class)
    public ResponseEntity<ErrorResponse> handleUnexpectedSettlementsException(UnexpectedSettlementsException unexpectedSettlementsException){
        log.error("An UnexpectedSettlementsException has occurred.", unexpectedSettlementsException);

        ErrorResponse errorResponse = new ErrorResponse(
                "There was a problem during reconciliation in that an internal transaction from the ledger did not have the expected number of corresponding processor settlement transactions.",
                Instant.now()
        );

        return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    /**
     * Handles bean validation failures on an {@code @Valid} request body or parameter.
     *
     * <p>The individual field violations are logged but not returned, keeping this response
     * identical in shape to every other error and matching
     * {@link #handleConstraintViolationException(ConstraintViolationException)}, which covers the
     * same class of problem detected at a different layer.
     *
     * @param methodArgumentNotValidException the validation failure, logged in full with its
     *                                        binding result
     * @return a {@code 400 Bad Request} reporting that validation failed
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentNotValidException(MethodArgumentNotValidException methodArgumentNotValidException){
        log.error("An MethodArgumentNotValidException has occurred.", methodArgumentNotValidException);

        ErrorResponse errorResponse = new ErrorResponse(
                "Validation failed.",
                Instant.now()
        );

        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

    /**
     * Handles constraint violations raised outside request binding, such as validation applied to
     * elements of a parsed upload.
     *
     * <p>Deliberately produces the same status and message as
     * {@link #handleMethodArgumentNotValidException(MethodArgumentNotValidException)} so callers
     * need not care which validation mechanism caught the problem.
     *
     * @param constraintViolationException the violation set, logged in full
     * @return a {@code 400 Bad Request} reporting that validation failed
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolationException(ConstraintViolationException constraintViolationException){
        log.error("An ConstraintViolationException has occurred.", constraintViolationException);

        ErrorResponse errorResponse = new ErrorResponse(
                "Validation failed.",
                Instant.now()
        );

        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

    /**
     * Catch-all for any exception no more specific handler claims.
     *
     * <p>Its purpose is containment: without it an unanticipated failure would surface as a
     * container-generated error page whose shape and contents this service does not control. The
     * message is intentionally uninformative, so the server log is the only place the real cause
     * can be read.
     *
     * @param ex the unanticipated failure, logged in full with its stack trace
     * @return a {@code 500 Internal Server Error} with a generic message
     */
    // The catch all
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAll(Exception ex){
        log.error("An unexpected server error has occurred.", ex);

        ErrorResponse errorResponse = new ErrorResponse(
                "An unexpected server error has occurred.",
                Instant.now()
        );

        return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
