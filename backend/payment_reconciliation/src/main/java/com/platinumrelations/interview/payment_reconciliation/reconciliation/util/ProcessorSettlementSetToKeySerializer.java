package com.platinumrelations.interview.payment_reconciliation.reconciliation.util;

import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

import java.util.Collection;

public class ProcessorSettlementSetToKeySerializer extends ValueSerializer<Collection<ProcessorSettlement>> {
    @Override
    public void serialize(Collection<ProcessorSettlement> value, JsonGenerator gen, SerializationContext ctxt) throws JacksonException {
        if(value == null){
            gen.writeNull();
            return;
        }

        gen.writeStartArray();
        for(ProcessorSettlement ps : value){
            gen.writeString(ps.networkRef());
        }

        gen.writeEndArray();
    }
}
