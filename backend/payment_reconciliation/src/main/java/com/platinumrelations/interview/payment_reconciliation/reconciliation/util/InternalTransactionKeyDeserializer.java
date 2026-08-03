package com.platinumrelations.interview.payment_reconciliation.reconciliation.util;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

/**
 * Writes an {@link InternalTransaction} used as a map key as its identifier alone.
 *
 * <p>JSON object keys must be scalars, so a transaction cannot be emitted as an object in key
 * position. Reducing it to {@code internalTxnId} loses nothing, because that identifier already
 * defines the transaction's equality &mdash; the key was never distinguishing more than this.
 *
 * <p>Note the name: despite {@code Deserializer}, this is a serializer, extending
 * {@link ValueSerializer} and writing rather than reading. The name is retained because it is
 * referenced by annotation from the model types.
 *
 * <p>Stateless and therefore thread-safe.
 *
 * @author John
 */
public class InternalTransactionKeyDeserializer extends ValueSerializer<InternalTransaction> {

    /**
     * Writes the transaction's identifier as the current field name.
     *
     * @param value the transaction in key position; a {@code null} value, or one with no
     *              identifier, is written as the literal name {@code "null"} so that sentinel keys
     *              from an outer-joined query still produce valid JSON
     * @param gen   the generator, positioned where a field name is expected
     * @param ctxt  the active serialization context; unused
     * @throws JacksonException if the name cannot be written
     */
    @Override
    public void serialize(InternalTransaction value, JsonGenerator gen, SerializationContext ctxt) throws JacksonException {
        if(value == null || value.getInternalTxnId() == null){
            gen.writeName("null");
            return;
        }

        gen.writeName(value.getInternalTxnId());
    }
}
