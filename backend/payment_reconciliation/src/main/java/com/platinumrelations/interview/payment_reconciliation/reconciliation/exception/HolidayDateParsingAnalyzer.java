package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.diagnostics.AbstractFailureAnalyzer;
import org.springframework.boot.diagnostics.FailureAnalysis;

@Slf4j
public class HolidayDateParsingAnalyzer extends AbstractFailureAnalyzer<FeeScheduleJsonParsingException> {

    @Override
    protected FailureAnalysis analyze(Throwable rootFailure, FeeScheduleJsonParsingException cause) {
        log.error("Startup failure intercepted by HolidayDateParsingAnalyzer: {}", cause.getMessage(), cause);

        String description = "A date has failed to parse in the list of holiday dates.";
        String action = "Please check the application.properties file to ensure the app.custom.holidays property is a comma seperated list of dates in YYYY-MM-DD format.";

        return new FailureAnalysis(description, action, cause);
    }
}
