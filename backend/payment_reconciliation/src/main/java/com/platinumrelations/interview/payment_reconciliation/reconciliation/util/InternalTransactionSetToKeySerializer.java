package com.platinumrelations.interview.payment_reconciliation.reconciliation.util;


import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

import java.util.Collection;

/**
 * Writes a collection of {@link InternalTransaction} as an array of their identifiers.
 *
 * <p>Applied where transactions appear in value position rather than as keys. The reduction is
 * about response size and shape, not about JSON limitations: the same transaction can appear under
 * many merchant references and in several views of one response, and emitting the full object each
 * time would repeat identical bodies throughout. A consumer that needs the detail looks it up once
 * by identifier.
 *
 * <p>Stateless and therefore thread-safe.
 *
 * @author John
 */
public class InternalTransactionSetToKeySerializer extends ValueSerializer<Collection<InternalTransaction>> {
    /**
     * Writes each transaction's identifier as an element of a JSON array.
     *
     * @param value the transactions to write; {@code null} is written as JSON {@code null} rather
     *              than an empty array, preserving the distinction between "absent" and "none".
     *              Must not itself contain {@code null} elements.
     * @param gen   the generator, positioned where a value is expected
     * @param ctxt  the active serialization context; unused
     * @throws JacksonException     if the array cannot be written
     * @throws NullPointerException if the collection contains a {@code null} element
     */
    @Override
    public void serialize(Collection<InternalTransaction> value, JsonGenerator gen, SerializationContext ctxt) throws JacksonException {
        if(value == null){
            gen.writeNull();
            return;
        }

        gen.writeStartArray();
        for(InternalTransaction it : value){
            gen.writeString(it.getInternalTxnId());
        }

        gen.writeEndArray();
    }
}
