package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;

import org.junit.jupiter.api.Test;
import org.springframework.boot.diagnostics.FailureAnalyzer;
import org.springframework.core.io.support.SpringFactoriesLoader;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies that this application's failure analyzers are actually discoverable by Spring.
 *
 * <p>Exists because they once were not: the registration file sat in a {@code META_INF} directory
 * spelled with an underscore, which Spring never reads, leaving both analyzers as dead code while
 * the application otherwise ran correctly. Nothing about the running system revealed it, so this
 * test stands in for the symptom that never appeared.
 */
public class FailureAnalyzerRegistrationTest {

    /**
     * Loads analyzers the way the framework does, from {@code META-INF/spring.factories}.
     *
     * <p>This also pulls in Spring Boot's own built-in analyzers, some of which take constructor
     * arguments that are unavailable here. The no-op failure handler lets those be skipped, so the
     * test only fails for reasons belonging to this project rather than to framework internals.
     */
    private List<FailureAnalyzer> loadRegisteredAnalyzers() {
        return SpringFactoriesLoader
                .forDefaultResourceLocation()
                .load(FailureAnalyzer.class, SpringFactoriesLoader.FailureHandler.handleMessage((message, failure) -> {
                }));
    }

    @Test
    void springFactories_registersFeeScheduleFailureAnalyzer() {
        List<FailureAnalyzer> analyzers = loadRegisteredAnalyzers();

        assertTrue(analyzers.stream().anyMatch(FeeScheduleFailureAnalyzer.class::isInstance),
                "FeeScheduleFailureAnalyzer is not registered in META-INF/spring.factories");
    }

    @Test
    void springFactories_registersHolidayDateParsingAnalyzer() {
        List<FailureAnalyzer> analyzers = loadRegisteredAnalyzers();

        assertTrue(analyzers.stream().anyMatch(HolidayDateParsingAnalyzer.class::isInstance),
                "HolidayDateParsingAnalyzer is not registered in META-INF/spring.factories");
    }
}
