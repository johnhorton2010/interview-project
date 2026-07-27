package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.diagnostics.AbstractFailureAnalyzer;
import org.springframework.boot.diagnostics.FailureAnalysis;

@Slf4j
public class FeeScheduleFailureAnalyzer extends AbstractFailureAnalyzer<FeeScheduleJsonParsingException> {

    @Override
    protected FailureAnalysis analyze(Throwable rootFailure, FeeScheduleJsonParsingException cause) {
        log.error("Startup failure intercepted by FeeScheduleFailureAnalyzer: {}", cause.getMessage(), cause);

        String description = "The fee_schedule.json file failed to parse.";
        String action = "Please verify the structure and included fields in the fee_schedule.json are correct.";

        return new FailureAnalysis(description, action, cause);
    }
}
