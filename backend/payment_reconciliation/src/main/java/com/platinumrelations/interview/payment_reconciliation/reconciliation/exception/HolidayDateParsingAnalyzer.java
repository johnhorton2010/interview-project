package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.diagnostics.AbstractFailureAnalyzer;
import org.springframework.boot.diagnostics.FailureAnalysis;

/**
 * Turns an unparseable holiday date into a readable startup diagnostic.
 *
 * <p>The counterpart to {@code FeeScheduleFailureAnalyzer}, pointing at
 * {@code application.properties} rather than the fee schedule. The type parameter is what selects
 * between them: Spring Boot only invokes an analyzer whose declared exception type matches the
 * failure, so each must be typed on the exception it explains.
 *
 * <p>Registered through {@code spring.factories} rather than as a bean, because it must be
 * available before the application context finishes refreshing.
 *
 * @author John
 */
@Slf4j
public class HolidayDateParsingAnalyzer extends AbstractFailureAnalyzer<HolidayDateParsingException> {

    /**
     * Builds the diagnostic for a holiday date parse failure.
     *
     * <p>Also logs the cause, since Spring Boot suppresses the stack trace when an analysis is
     * returned.
     *
     * @param rootFailure the outermost failure Spring Boot caught, typically a bean creation
     *                    failure wrapping {@code cause}; not used, as the cause carries the
     *                    actionable detail
     * @param cause       the date parse failure that triggered the analysis
     * @return the description and suggested action shown in place of the stack trace; never
     *         {@code null}
     */
    @Override
    protected FailureAnalysis analyze(Throwable rootFailure, HolidayDateParsingException cause) {
        log.error("Startup failure intercepted by HolidayDateParsingAnalyzer: {}", cause.getMessage(), cause);

        String description = "A date has failed to parse in the list of holiday dates.";
        String action = "Please check the application.properties file to ensure the app.custom.holidays property is a comma separated list of dates in YYYY-MM-DD format.";

        return new FailureAnalysis(description, action, cause);
    }
}
