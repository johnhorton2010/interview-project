package com.platinumrelations.interview.payment_reconciliation.reconciliation.util;

import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

/**
 * Writes a {@link ProcessorSettlement} used as a map key as its network reference alone.
 *
 * <p>The settlement-side counterpart to {@link InternalTransactionToKeySerializer}, for the same
 * reason: JSON object keys must be scalars, and {@code networkRef} already defines the
 * settlement's equality.
 *
 * <p>Stateless and therefore thread-safe.
 *
 * @author John
 */
public class ProcessorSettlementToKeySerializer extends ValueSerializer<ProcessorSettlement> {

    /**
     * Writes the settlement's network reference as the current field name.
     *
     * @param value the settlement in key position; a {@code null} value, or one with no network
     *              reference, is written as the literal name {@code "null"} so that sentinel keys
     *              from an outer-joined query still produce valid JSON
     * @param gen   the generator, positioned where a field name is expected
     * @param ctxt  the active serialization context; unused
     * @throws JacksonException if the name cannot be written
     */
    @Override
    public void serialize(ProcessorSettlement value, JsonGenerator gen, SerializationContext ctxt) throws JacksonException {
        if(value == null || value.getNetworkRef() == null){
            gen.writeName("null");
            return;
        }

        gen.writeName (value.getNetworkRef());
    }
}
