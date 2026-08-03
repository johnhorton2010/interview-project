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

/**
 * Exposes the contents of {@code fee_schedule.json} as application beans.
 *
 * <p>The schedule is the single source of truth for what a settlement <em>should</em> have been,
 * so it is read once at startup and published as immutable beans rather than re-read per
 * transaction. Every parse problem raises {@link FeeScheduleJsonParsingException}, which fails the
 * context deliberately: reconciling against a partially-understood fee schedule would silently
 * mis-classify every row, so refusing to start is the safer outcome. The resulting startup failure
 * is rendered into an actionable message by {@code FeeScheduleFailureAnalyzer}.
 *
 * <p>Amounts in the file are JSON <em>strings</em> and are converted with
 * {@link BigDecimal#BigDecimal(String)} so the declared scale survives intact; going through
 * {@code double} would introduce exactly the sub-cent drift the tolerance band exists to absorb.
 *
 * @author John
 */
@Slf4j
@Configuration
public class FeeSchedule {

    /**
     * Creates the configuration with the resources needed to read the schedule.
     *
     * <p>Package-private: instantiation is Spring's job. Nothing is parsed here, so construction
     * cannot fail; the file is read when the bean methods run.
     *
     * @param jsonResource the classpath location of {@code fee_schedule.json}
     * @param jsonMapper   the shared Jackson mapper used to read the file
     */
    FeeSchedule(@Value("classpath:fee_schedule.json")Resource jsonResource, JsonMapper jsonMapper){
        this.jsonResource = jsonResource;
        this.jsonMapper = jsonMapper;
    }

    /** Classpath handle to {@code fee_schedule.json}; re-read by each bean method. */
    Resource jsonResource;
    /** Jackson mapper used to turn the schedule file into a tree. */
    JsonMapper jsonMapper;

    /**
     * Builds the per-network interchange fee lookup from the {@code interchange} object.
     *
     * <p>Keys in the file must name {@link CardType} constants; an unrecognised network therefore
     * fails the context rather than being skipped, because a missing entry would later surface as
     * a {@code NullPointerException} deep inside fee computation.
     *
     * @return an unmodifiable map from card network to its interchange fee; never {@code null} and
     *         never containing {@code null} values
     * @throws FeeScheduleJsonParsingException if the file cannot be read, has no {@code interchange}
     *                                         object, or an entry is missing {@code percent} or
     *                                         {@code flat}
     * @throws IllegalArgumentException        if a key does not name a known {@link CardType}
     * @throws NumberFormatException           if a {@code percent} or {@code flat} value is not a
     *                                         valid decimal
     */
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

    /**
     * Reads the processor's own markup from the {@code processor_markup} object.
     *
     * <p>Unlike interchange, the markup is network-independent and so is a single {@link Fee}
     * applied to every transaction regardless of card type.
     *
     * @return the processor markup fee; never {@code null}
     * @throws FeeScheduleJsonParsingException if the file cannot be read, has no
     *                                         {@code processor_markup} object, or that object is
     *                                         missing {@code percent} or {@code flat}
     * @throws NumberFormatException           if either value is not a valid decimal
     */
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

    /**
     * Reads and parses the schedule file into a JSON tree.
     *
     * <p>Called separately by each bean method rather than cached, since it runs only twice during
     * startup and keeping the configuration stateless avoids ordering assumptions between beans.
     *
     * @param jsonResource the classpath location of the schedule file
     * @param jsonMapper   the mapper used to parse it
     * @return the root node of the parsed document; never {@code null}
     * @throws FeeScheduleJsonParsingException if the resource cannot be read as UTF-8 or parses to
     *                                         no root node
     */
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

