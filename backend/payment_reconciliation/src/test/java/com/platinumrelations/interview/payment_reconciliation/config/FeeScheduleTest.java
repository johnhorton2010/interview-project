package com.platinumrelations.interview.payment_reconciliation.config;

import com.platinumrelations.interview.payment_reconciliation.core.config.FeeSchedule;
import com.platinumrelations.interview.payment_reconciliation.core.model.CardType;
import com.platinumrelations.interview.payment_reconciliation.core.model.Fee;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;

import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringJUnitConfig(classes = {FeeSchedule.class, JsonMapper.class})
public class FeeScheduleTest {

    @Autowired
    @Qualifier("interchangeFeeMap")
    Map<CardType, Fee> interchangeFeeMap;

    @Autowired
    @Qualifier("processorMarkup")
    Fee processorMarkup;

    @Test
    void verifyInterchangeFeeSuccessfullyLoadedWithValues() {
        assertFalse(interchangeFeeMap.isEmpty());

        Map.Entry<CardType, Fee> firstEntry = interchangeFeeMap.entrySet().stream().findFirst().orElse(null);
        assertNotNull(firstEntry);

        Fee interchangeFee = firstEntry.getValue();
        assertNotNull(interchangeFee);
        assertNotNull(interchangeFee.flat());
        assertNotNull(interchangeFee.percent());
    }

    @Test
    void verifyInterchangeFeeIsUnmodifiable() {
        Map.Entry<CardType, Fee> firstEntry = interchangeFeeMap.entrySet().stream().findFirst().orElse(null);
        assertNotNull(firstEntry);

        assertThrows(UnsupportedOperationException.class, () -> interchangeFeeMap.remove(firstEntry.getKey()));
    }

    @Test
    void verifyProcessorMarkupSuccessfullyLoadedWithValues() {
        assertNotNull(processorMarkup);
        assertNotNull(processorMarkup.flat());
        assertNotNull(processorMarkup.percent());
    }
}
