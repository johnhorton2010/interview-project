package com.platinumrelations.interview.payment_reconciliation.core.exception;

import lombok.Data;

import java.time.Instant;

@Data
public class ErrorResponse {

    public ErrorResponse(String message, Instant timestamp){
        this.message = message;
        this.timestamp = timestamp;
    }

    private String message;
    private Instant timestamp;
}
