package com.platinumrelations.interview.payment_reconciliation.ledger.exception;

public class LedgerCsvParsingException extends  RuntimeException{

    public LedgerCsvParsingException(String message){
        super(message);
    }

    public LedgerCsvParsingException(String message, Throwable cause){
        super(message,cause);
    }
}
