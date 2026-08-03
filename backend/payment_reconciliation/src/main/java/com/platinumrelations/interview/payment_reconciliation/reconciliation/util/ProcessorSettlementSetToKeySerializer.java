package com.platinumrelations.interview.payment_reconciliation.reconciliation.util;

import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

import java.util.Collection;

/**
 * Writes a collection of {@link ProcessorSettlement} as an array of their network references.
 *
 * <p>The settlement-side counterpart to {@code InternalTransactionSetToKeySerializer}, for the
 * same reason: a settlement can appear in several views of one response, and repeating the full
 * object each time would bloat it with identical bodies.
 *
 * <p>Stateless and therefore thread-safe.
 *
 * @author John
 */
public class ProcessorSettlementSetToKeySerializer extends ValueSerializer<Collection<ProcessorSettlement>> {
    /**
     * Writes each settlement's network reference as an element of a JSON array.
     *
     * @param value the settlements to write; {@code null} is written as JSON {@code null} rather
     *              than an empty array, preserving the distinction between "absent" and "none".
     *              Must not itself contain {@code null} elements.
     * @param gen   the generator, positioned where a value is expected
     * @param ctxt  the active serialization context; unused
     * @throws JacksonException     if the array cannot be written
     * @throws NullPointerException if the collection contains a {@code null} element
     */
    @Override
    public void serialize(Collection<ProcessorSettlement> value, JsonGenerator gen, SerializationContext ctxt) throws JacksonException {
        if(value == null){
            gen.writeNull();
            return;
        }

        gen.writeStartArray();
        for(ProcessorSettlement ps : value){
            gen.writeString(ps.getNetworkRef());
        }

        gen.writeEndArray();
    }
}
