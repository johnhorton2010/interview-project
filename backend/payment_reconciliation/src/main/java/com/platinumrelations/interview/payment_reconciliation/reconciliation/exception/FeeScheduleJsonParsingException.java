package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;

public class FeeScheduleJsonParsingException extends RuntimeException{

    public FeeScheduleJsonParsingException(String message){
        super(message);
    }

    public FeeScheduleJsonParsingException(String message, Throwable cause){
        super(message, cause);
    }
}
