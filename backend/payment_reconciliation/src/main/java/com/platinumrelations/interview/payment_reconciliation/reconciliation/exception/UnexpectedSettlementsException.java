package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;

public class UnexpectedSettlementsException extends RuntimeException{

    public UnexpectedSettlementsException(String message){
        super(message);
    }

    public UnexpectedSettlementsException(String message, Throwable cause){
        super(message, cause);
    }
}
