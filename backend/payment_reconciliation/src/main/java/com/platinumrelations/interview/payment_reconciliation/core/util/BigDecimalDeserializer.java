package com.platinumrelations.interview.payment_reconciliation.core.util;

import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

import java.math.BigDecimal;

@Slf4j
public class BigDecimalDeserializer extends ValueDeserializer<BigDecimal> {

    @Override
    public BigDecimal deserialize(JsonParser p, DeserializationContext ctxt) throws JacksonException {
        BigDecimal rtnVal;
        try {
            rtnVal = new BigDecimal(p.getValueAsString());
        }catch (IllegalArgumentException ex){
            // This is handled gracefully and doesn't impact the running application.
            // It is also expected behavior so it shouldn't be logged at a very high level.
            log.debug("Couldn't turn the string: {} into BigDecimal", p.getValueAsString(), ex);
            rtnVal = BigDecimal.ZERO;
        }

        return rtnVal;
    }
}
