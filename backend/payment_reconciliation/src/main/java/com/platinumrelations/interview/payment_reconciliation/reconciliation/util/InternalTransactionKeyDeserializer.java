package com.platinumrelations.interview.payment_reconciliation.reconciliation.util;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

public class InternalTransactionKeyDeserializer extends ValueSerializer<InternalTransaction> {

    @Override
    public void serialize(InternalTransaction value, JsonGenerator gen, SerializationContext ctxt) throws JacksonException {
        if(value == null || value.getInternalTxnId() == null){
            gen.writeName("null");
            return;
        }

        gen.writeName(value.getInternalTxnId());
    }
}
