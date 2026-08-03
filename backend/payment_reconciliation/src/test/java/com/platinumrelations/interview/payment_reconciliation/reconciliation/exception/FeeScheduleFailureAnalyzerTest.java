package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;

import org.junit.jupiter.api.Test;
import org.springframework.boot.diagnostics.FailureAnalysis;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class FeeScheduleFailureAnalyzerTest {

    private final FeeScheduleFailureAnalyzer analyzer = new FeeScheduleFailureAnalyzer();

    @Test
    void analyze_returnsAnalysis_whenCauseIsFeeScheduleJsonParsingException() {
        FeeScheduleJsonParsingException cause =
                new FeeScheduleJsonParsingException("Problem parsing the fee_schedule.json at the interchange key.");

        FailureAnalysis analysis = analyzer.analyze(cause);

        assertNotNull(analysis);
        assertEquals(cause, analysis.getCause());
    }

    @Test
    void analyze_describesTheFeeScheduleFile_whenCauseIsFeeScheduleJsonParsingException() {
        FailureAnalysis analysis = analyzer.analyze(new FeeScheduleJsonParsingException("unparseable"));

        assertNotNull(analysis);
        // Guards against the two analyzers' messages being swapped: this one must point at the fee
        // schedule file, not at the holiday property.
        assertTrue(analysis.getDescription().contains("fee_schedule.json"));
        assertTrue(analysis.getAction().contains("fee_schedule.json"));
    }

    @Test
    void analyze_returnsNull_whenCauseIsHolidayDateParsingException() {
        // The counterpart of the regression guard in HolidayDateParsingAnalyzerTest: the two
        // analyzers must not both claim the same failure.
        FailureAnalysis analysis = analyzer.analyze(new HolidayDateParsingException("unparseable holiday"));

        assertNull(analysis);
    }

    @Test
    void analyze_returnsAnalysis_whenCauseIsWrapped() {
        FeeScheduleJsonParsingException cause = new FeeScheduleJsonParsingException("unparseable");
        RuntimeException wrapper = new RuntimeException("Error creating bean 'interchangeFeeMap'", cause);

        FailureAnalysis analysis = analyzer.analyze(wrapper);

        assertNotNull(analysis);
        assertEquals(cause, analysis.getCause());
    }

    @Test
    void analyze_returnsNull_whenCauseIsUnrelated() {
        assertNull(analyzer.analyze(new IllegalStateException("something else entirely")));
    }
}
