package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.exception.HolidayDateParsingException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Detects settlements that arrived correct but later than the expected business-day window.
 *
 * <p>The one categorizer that reports timing rather than money. A settlement outside the window
 * is not necessarily wrong &mdash; the funds did arrive, in the right amount &mdash; so this is
 * ranked below the amount and fee checks and reports an anomaly worth investigating rather than a
 * monetary break.
 *
 * <p>The window is counted in business days, not calendar days, because settlement pipelines do
 * not run at weekends or on bank holidays. Counting calendar days would flag every transaction
 * captured on a Friday. Weekends are derived, while holidays are configured through
 * {@code app.custom.holidays}, since they vary by jurisdiction and year and cannot be computed.
 *
 * <p>Holiday dates are parsed once at construction and an unparseable entry fails startup, so a
 * misconfigured calendar is reported plainly rather than silently distorting the window for every
 * transaction in every run.
 *
 * @author John
 */
@Service
class WideWindowCategorizer {

    /**
     * Parses and validates the business-day calendar.
     *
     * @param windowMaxDays the number of business days a settlement may take before it counts as
     *                      late, from {@code app.custom.wide-window.max-days}
     * @param holidays      non-business days as ISO {@code YYYY-MM-DD} strings, from the
     *                      comma-separated {@code app.custom.holidays}; an empty list is valid and
     *                      leaves weekends as the only excluded days
     * @throws HolidayDateParsingException if any entry is not a parseable ISO date, aborting
     *                                     application startup
     */
    WideWindowCategorizer(@Value("${app.custom.wide-window.max-days}") int windowMaxDays, @Value("${app.custom.holidays}") List<String> holidays){
        this.windowMaxDays = windowMaxDays;

        this.holidays = new ArrayList<>();
        for(String holidayStr : holidays){
            LocalDate date;
            try {
                date = LocalDate.parse(holidayStr);
            }catch (DateTimeParseException ex){
                throw new HolidayDateParsingException("The predefined list of holidays has date: " + holidayStr + " that cannot be parsed.");
            }

            this.holidays.add(date);
        }
    }

    /** Business days a settlement may take before it is considered late. */
    private final int windowMaxDays;
    /** Configured non-business days, excluded from the count alongside weekends. */
    private final List<LocalDate> holidays;

    /**
     * Tests whether a settlement took more business days than the window allows.
     *
     * <p>Counting starts the day after capture, since a settlement on the capture date itself has
     * taken no time at all, and stops at the settlement date, which is not itself counted. Days
     * falling on a weekend or in the configured holiday list are skipped.
     *
     * <p>Only the date part of the capture timestamp is used, so the time of day and its offset do
     * not affect the result. A settlement dated on or before the capture date yields a count of
     * zero and is not flagged.
     *
     * @param it the ledger side, supplying the capture timestamp
     * @param ps the settlement side, supplying the settlement date
     * @return {@code true} if at least {@code windowMaxDays} business days elapsed between capture
     *         and settlement
     * @throws NullPointerException if the capture timestamp or the settlement date is {@code null}
     */
    boolean hasWideWindow(InternalTransaction it, ProcessorSettlement ps){
        LocalDate curDate = it.getCapturedAt().toLocalDate();

        // Starting at t+1
        curDate = curDate.plusDays(1);
        int buisnessDaysCount = 0;
        while (curDate.isBefore(ps.getSettlementDate()) && buisnessDaysCount <= windowMaxDays){
            DayOfWeek dayOfWeek = curDate.getDayOfWeek();

            boolean isWeekend = (dayOfWeek == DayOfWeek.SATURDAY) || (dayOfWeek == DayOfWeek.SUNDAY);

            if(!isWeekend && !holidays.contains(curDate)){
                buisnessDaysCount++;
            }

            curDate = curDate.plusDays(1);
        }

        return buisnessDaysCount >= windowMaxDays;
    }
}
