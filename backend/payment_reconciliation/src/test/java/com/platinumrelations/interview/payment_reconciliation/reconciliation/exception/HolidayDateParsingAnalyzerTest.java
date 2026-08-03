package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;

import org.junit.jupiter.api.Test;
import org.springframework.boot.diagnostics.FailureAnalysis;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class HolidayDateParsingAnalyzerTest {

    private final HolidayDateParsingAnalyzer analyzer = new HolidayDateParsingAnalyzer();

    @Test
    void analyze_returnsAnalysis_whenCauseIsHolidayDateParsingException() {
        HolidayDateParsingException cause = new HolidayDateParsingException("date 2026-13-45 cannot be parsed");

        FailureAnalysis analysis = analyzer.analyze(cause);

        assertNotNull(analysis);
        assertEquals(cause, analysis.getCause());
    }

    @Test
    void analyze_describesTheHolidayProperty_whenCauseIsHolidayDateParsingException() {
        FailureAnalysis analysis = analyzer.analyze(new HolidayDateParsingException("unparseable"));

        assertNotNull(analysis);
        // Guards against the two analyzers' messages being swapped: this one must point at the
        // holiday property, not at the fee schedule file.
        assertTrue(analysis.getDescription().contains("holiday"));
        assertTrue(analysis.getAction().contains("app.custom.holidays"));
    }

    @Test
    void analyze_returnsNull_whenCauseIsFeeScheduleException() {
        // Regression guard. This analyzer was previously typed on FeeScheduleJsonParsingException,
        // so it claimed fee schedule failures and never saw its own.
        FailureAnalysis analysis = analyzer.analyze(new FeeScheduleJsonParsingException("bad fee schedule"));

        assertNull(analysis);
    }

    @Test
    void analyze_returnsAnalysis_whenCauseIsWrapped() {
        // Spring Boot hands the analyzer the outermost failure, typically a bean creation failure,
        // rather than the root cause.
        HolidayDateParsingException cause = new HolidayDateParsingException("unparseable");
        RuntimeException wrapper = new RuntimeException("Error creating bean 'wideWindowCategorizer'", cause);

        FailureAnalysis analysis = analyzer.analyze(wrapper);

        assertNotNull(analysis);
        assertEquals(cause, analysis.getCause());
    }

    @Test
    void analyze_returnsNull_whenCauseIsUnrelated() {
        assertNull(analyzer.analyze(new IllegalStateException("something else entirely")));
    }
}
