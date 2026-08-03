package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.diagnostics.AbstractFailureAnalyzer;
import org.springframework.boot.diagnostics.FailureAnalysis;

/**
 * Turns a fee schedule parse failure into a readable startup diagnostic.
 *
 * <p>Without an analyzer, a bean-creation failure of this kind reaches the console as a stack
 * trace whose root cause is buried several frames down. Spring Boot instead prints this analysis
 * and suppresses the trace, so the operator is told which file is wrong and what to do about it.
 *
 * <p>Registered through {@code spring.factories} rather than as a bean, because it must be
 * available before the application context finishes refreshing &mdash; which is exactly when the
 * failure it handles occurs.
 *
 * @author John
 */
@Slf4j
public class FeeScheduleFailureAnalyzer extends AbstractFailureAnalyzer<FeeScheduleJsonParsingException> {

    /**
     * Builds the diagnostic for a fee schedule parse failure.
     *
     * <p>Also logs the cause, since the suppressed stack trace would otherwise be lost and the
     * console analysis alone omits the failing frame.
     *
     * @param rootFailure the outermost failure Spring Boot caught, typically a bean creation
     *                    failure wrapping {@code cause}; not used, as the cause carries the
     *                    actionable detail
     * @param cause       the parse failure that triggered the analysis
     * @return the description and suggested action shown in place of the stack trace; never
     *         {@code null}, so this analyzer always claims a failure it is typed for
     */
    @Override
    protected FailureAnalysis analyze(Throwable rootFailure, FeeScheduleJsonParsingException cause) {
        log.error("Startup failure intercepted by FeeScheduleFailureAnalyzer: {}", cause.getMessage(), cause);

        String description = "The fee_schedule.json file failed to parse.";
        String action = "Please verify the structure and included fields in the fee_schedule.json are correct.";

        return new FailureAnalysis(description, action, cause);
    }
}
