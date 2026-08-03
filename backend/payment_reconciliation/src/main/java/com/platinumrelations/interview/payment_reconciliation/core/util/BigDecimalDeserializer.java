package com.platinumrelations.interview.payment_reconciliation.core.util;

import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

import java.math.BigDecimal;

/**
 * Lenient Jackson deserializer that maps an unparseable numeric field to {@link BigDecimal#ZERO}.
 *
 * <p>Inbound ledger and settlement files are third-party data and are expected to contain
 * malformed amount columns. Failing the whole upload on one bad cell would be worse than loading
 * it, because a row with a zero amount cannot reconcile and is therefore caught downstream and
 * classified as quarantined rather than silently accepted. The substitution is deliberate, not a
 * fallback for a bug, which is why it is logged at {@code DEBUG}.
 *
 * <p>Stateless and therefore thread-safe; a single instance may be shared by the object mapper.
 *
 * @author John
 */
@Slf4j
public class BigDecimalDeserializer extends ValueDeserializer<BigDecimal> {

    /**
     * Reads the current token as a {@code BigDecimal}, substituting zero when it cannot be parsed.
     *
     * @param p    the parser positioned on the value to read
     * @param ctxt the active deserialization context; unused, as malformed input is absorbed here
     *             rather than reported through the context
     * @return the parsed value, or {@link BigDecimal#ZERO} if the token is a string that is not a
     *         valid decimal
     * @throws JacksonException     if the underlying parser fails while reading the token
     * @throws NullPointerException if the token is JSON {@code null}; only
     *                              {@link IllegalArgumentException} is absorbed, so a truly absent
     *                              value surfaces rather than being silently zeroed
     */
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
