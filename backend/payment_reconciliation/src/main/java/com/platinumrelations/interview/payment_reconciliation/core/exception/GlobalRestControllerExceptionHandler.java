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

@Slf4j
@RestControllerAdvice
public class GlobalRestControllerExceptionHandler {

    @ExceptionHandler(LedgerCsvParsingException.class)
    public ResponseEntity<ErrorResponse> handleLedgerCsvParsingException(LedgerCsvParsingException ledgerCsvParsingException){
        log.error("A LedgerCsvParsingException has occurred.", ledgerCsvParsingException);

        ErrorResponse errorResponse = new ErrorResponse(
                "The CSV file was not able to be parsed.",
                Instant.now()
        );

        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(UnexpectedSettlementsException.class)
    public ResponseEntity<ErrorResponse> handleUnexpectedSettlementsException(UnexpectedSettlementsException unexpectedSettlementsException){
        log.error("An UnexpectedSettlementsException has occurred.", unexpectedSettlementsException);

        ErrorResponse errorResponse = new ErrorResponse(
                "There was a problem during reconciliation in that an internal transaction from the ledger did not have the expected number of corresponding processor settlement transactions.",
                Instant.now()
        );

        return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentNotValidException(MethodArgumentNotValidException methodArgumentNotValidException){
        log.error("An MethodArgumentNotValidException has occurred.", methodArgumentNotValidException);

        ErrorResponse errorResponse = new ErrorResponse(
                "Validation failed.",
                Instant.now()
        );

        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolationException(ConstraintViolationException constraintViolationException){
        log.error("An ConstraintViolationException has occurred.", constraintViolationException);

        ErrorResponse errorResponse = new ErrorResponse(
                "Validation failed.",
                Instant.now()
        );

        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

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
