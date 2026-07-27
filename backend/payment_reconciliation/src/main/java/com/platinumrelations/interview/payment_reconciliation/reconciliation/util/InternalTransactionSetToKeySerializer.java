package com.platinumrelations.interview.payment_reconciliation.reconciliation.util;


import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

import java.util.Collection;

public class InternalTransactionSetToKeySerializer extends ValueSerializer<Collection<InternalTransaction>> {
    @Override
    public void serialize(Collection<InternalTransaction> value, JsonGenerator gen, SerializationContext ctxt) throws JacksonException {
        if(value == null){
            gen.writeNull();
            return;
        }

        gen.writeStartArray();
        for(InternalTransaction it : value){
            gen.writeString(it.internalTxnId());
        }

        gen.writeEndArray();
    }
}
