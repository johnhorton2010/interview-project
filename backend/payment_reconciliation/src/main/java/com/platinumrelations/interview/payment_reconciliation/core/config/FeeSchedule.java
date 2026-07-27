package com.platinumrelations.interview.payment_reconciliation.core.config;

import com.platinumrelations.interview.payment_reconciliation.core.model.CardType;
import com.platinumrelations.interview.payment_reconciliation.core.model.Fee;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.exception.FeeScheduleJsonParsingException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Configuration
public class FeeSchedule {

    FeeSchedule(@Value("classpath:fee_schedule.json")Resource jsonResource, JsonMapper jsonMapper){
        this.jsonResource = jsonResource;
        this.jsonMapper = jsonMapper;
    }

    Resource jsonResource;
    JsonMapper jsonMapper;

    @Bean(name = "interchangeFeeMap")
    public Map<CardType, Fee> interchangeFeeMap() {
        HashMap<CardType, Fee> interchangeMap = new HashMap<>();

        JsonNode root = getJsonRoot(jsonResource, jsonMapper);

        JsonNode interchangeRoot = root.get("interchange");
        if(interchangeRoot == null){
            throw new FeeScheduleJsonParsingException("Problem parsing the fee_schedule.json at the interchange key.");
        }

        interchangeRoot.properties().forEach(entry -> {
            String percentString = entry.getValue().get("percent").asString();
            if(percentString == null){
                throw new FeeScheduleJsonParsingException("Problem parsing the fee_schedule.json percent value for the interchange key of: " + interchangeRoot.asString());
            }

            String flatString = entry.getValue().get("flat").asString();

            if(flatString == null){
                throw new FeeScheduleJsonParsingException("Problem parsing the fee_schedule.json flat value for the interchange key of: " + interchangeRoot.asString());
            }

            BigDecimal percentage = new BigDecimal(percentString);
            BigDecimal flat = new BigDecimal(flatString);

            interchangeMap.put(CardType.valueOf(entry.getKey()), new Fee(percentage, flat));
        });

        return Collections.unmodifiableMap(interchangeMap);
    }

    @Bean(name = "processorMarkup")
    public Fee processorMarkup() {
        JsonNode root = getJsonRoot(jsonResource, jsonMapper);

        JsonNode processorMarkupRoot = root.get("processor_markup");
        if(processorMarkupRoot == null){
            throw new FeeScheduleJsonParsingException("Problem parsing the fee_schedule.json at the processor_markup key.");
        }

        String percentString = processorMarkupRoot.get("percent").asString();
        if(percentString == null){
            throw new FeeScheduleJsonParsingException("Problem parsing the fee_schedule.json percent value for the process_markup key.");
        }

        String flatString = processorMarkupRoot.get("flat").asString();
        if(flatString == null){
            throw new FeeScheduleJsonParsingException("Problem parsing the fee_schedule.json flat value for the process_markup key.");
        }

        BigDecimal percent = new BigDecimal(percentString);
        BigDecimal flat = new BigDecimal(flatString);

        return new Fee(percent, flat);
    }

    private JsonNode getJsonRoot(Resource jsonResource, JsonMapper jsonMapper) {
        JsonNode root;
        try {
            root = jsonMapper.readTree(jsonResource.getContentAsString(StandardCharsets.UTF_8));
        }catch (IOException ex){
            throw new FeeScheduleJsonParsingException("Cannot read the fee_schedule.json");
        }

        if(root == null){
            throw new FeeScheduleJsonParsingException("Problem parsing the fee_schedule.json at the root.");
        }

        return root;
    }
}

