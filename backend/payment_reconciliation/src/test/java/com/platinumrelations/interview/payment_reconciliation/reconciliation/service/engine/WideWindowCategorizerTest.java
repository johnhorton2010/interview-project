package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.exception.HolidayDateParsingException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
public class WideWindowCategorizerTest {

    private WideWindowCategorizer wideWindowCategorizer;

    @BeforeEach
    void setUp() {
        String holidayCsvStr = "2026-01-01,2026-01-19,2026-02-16,2026-05-25,2026-06-19,2026-07-04,2026-09-07,2026-08-12,2026-11-26,2026-12-25";
        wideWindowCategorizer = new WideWindowCategorizer(5, List.of(holidayCsvStr.split(",")));
    }

    @Test
    void hasWideWindow_true_whenDateOneMoreThanWideWindowMax(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .capturedAt(LocalDate.of(2026, 6, 1).atStartOfDay(ZoneId.of("America/New_York")).toInstant())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settlementDate(LocalDate.of(2026, 6, 9))
                .build();

        assertTrue(wideWindowCategorizer.hasWideWindow(it, ps));
    }

    @Test
    void hasWideWindow_false_whenDateExactlyAtWideWindowMax(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .capturedAt(LocalDate.of(2026, 6, 1).atStartOfDay(ZoneId.of("America/New_York")).toInstant())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settlementDate(LocalDate.of(2026, 6, 8))
                .build();

        assertFalse(wideWindowCategorizer.hasWideWindow(it, ps));
    }

    @Test
    void hasWideWindow_false_whenDateWithinWideWindowMaxOnceHolidayIsAccountedFor(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .capturedAt(LocalDate.of(2026, 12, 21).atStartOfDay(ZoneId.of("America/New_York")).toInstant())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settlementDate(LocalDate.of(2026, 6, 29))
                .build();

        assertFalse(wideWindowCategorizer.hasWideWindow(it, ps));
    }

    @Test
    void hasWideWindow_true_whenDateMoreThanWideWindowMaxOnceHolidayIsAccountedFor(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .capturedAt(LocalDate.of(2026, 9, 21).atStartOfDay(ZoneId.of("America/New_York")).toInstant())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settlementDate(LocalDate.of(2026, 9, 29))
                .build();

        assertTrue(wideWindowCategorizer.hasWideWindow(it, ps));
    }

    @Test
    void hasWideWindow_true_whenCapturedAtDateIsBeforeHolidayWeekdayAndWide(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .capturedAt(LocalDate.of(2025, 12, 31).atStartOfDay(ZoneId.of("America/New_York")).toInstant())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settlementDate(LocalDate.of(2026, 1, 9))
                .build();

        assertTrue(wideWindowCategorizer.hasWideWindow(it, ps));
    }

    @Test
    void hasWideWindow_false_whenCapturedAtDateIsBeforeHolidayWeekdayAndWithinWindow(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .capturedAt(LocalDate.of(2025, 12, 31).atStartOfDay(ZoneId.of("America/New_York")).toInstant())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settlementDate(LocalDate.of(2026, 1, 8))
                .build();

        assertFalse(wideWindowCategorizer.hasWideWindow(it, ps));
    }

    @Test
    void hasWideWindow_false_whenStartAndEndDatesMatch(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .capturedAt(LocalDate.of(2026, 2, 2).atStartOfDay(ZoneId.of("America/New_York")).toInstant())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settlementDate(LocalDate.of(2026, 2, 2))
                .build();

        assertFalse(wideWindowCategorizer.hasWideWindow(it, ps));
    }

    @Test
    void hasWideWindow_true_whenDatesAreVeryFarApart(){
        InternalTransaction it =InternalTransaction
                .builder()
                .internalTxnId("it1")
                .capturedAt(LocalDate.of(2026, 3, 1).atStartOfDay(ZoneId.of("America/New_York")).toInstant())
                .build();
        ProcessorSettlement ps = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .settlementDate(LocalDate.of(2026, 3, 31))
                .build();

        assertTrue(wideWindowCategorizer.hasWideWindow(it, ps));
    }

    @Test
    @Tag("skipSetUp")
    void hasWideWindow_throwsException_whenDatePropertyIsMangled(){
        String holidayCsvStr = "tthththt2026-01-01,2026-01-19,2026-02-16,2026-05-25,2026-06-19,2026-07-04,2026-09-07,2026-08-12,2026-11-26,2026-12-25";
        assertThrows(HolidayDateParsingException.class, () -> new WideWindowCategorizer(5, List.of(holidayCsvStr.split(","))));
    }
}
