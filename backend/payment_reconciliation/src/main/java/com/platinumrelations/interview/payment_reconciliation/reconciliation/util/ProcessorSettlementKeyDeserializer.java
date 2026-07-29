package com.platinumrelations.interview.payment_reconciliation.reconciliation.util;

import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

public class ProcessorSettlementKeyDeserializer extends ValueSerializer<ProcessorSettlement> {

    @Override
    public void serialize(ProcessorSettlement value, JsonGenerator gen, SerializationContext ctxt) throws JacksonException {
        if(value == null || value.getNetworkRef() == null){
            gen.writeName("null");
            return;
        }

        gen.writeName (value.getNetworkRef());
    }
}
