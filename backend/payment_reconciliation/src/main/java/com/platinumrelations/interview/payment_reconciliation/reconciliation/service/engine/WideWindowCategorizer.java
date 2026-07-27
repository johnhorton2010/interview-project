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

@Service
class WideWindowCategorizer {

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

    private final int windowMaxDays;
    private final List<LocalDate> holidays;

    boolean hasWideWindow(InternalTransaction it, ProcessorSettlement ps){
        // Assuming that we are using eastern time  for buisness days in alignment with the federal reserve and major banks
        LocalDate curDate = it.capturedAt().atZone(ZoneId.of("America/New_York")).toLocalDate();

        // Starting at t+1
        curDate = curDate.plusDays(1);
        int buisnessDaysCount = 0;
        while (curDate.isBefore(ps.settlementDate()) && buisnessDaysCount <= windowMaxDays){
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
