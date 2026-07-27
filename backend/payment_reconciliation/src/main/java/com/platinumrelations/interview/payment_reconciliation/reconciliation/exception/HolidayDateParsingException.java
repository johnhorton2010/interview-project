package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;

public class HolidayDateParsingException extends RuntimeException{

    public HolidayDateParsingException(String message){
        super(message);
    }

    public HolidayDateParsingException(String message, Throwable cause){
        super(message, cause);
    }
}
