package com.platinumrelations.interview.payment_reconciliation.processor.repository;

import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSourceUtils;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
public class ProcessorSettlementRepository {

    public ProcessorSettlementRepository(NamedParameterJdbcTemplate namedParameterJdbcTemplate, JdbcClient jdbcClient){
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
        this.jdbcClient = jdbcClient;
    }

    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final JdbcClient jdbcClient;

    public List<ProcessorSettlement> findNullOrEmptyMerchantRefSettlements(){
        String sql = """
                SELECT *
                FROM   processor_settlement
                WHERE  merchant_ref IS NULL
                        OR Trim(merchant_ref) = ''
                """;

        return jdbcClient.sql(sql).query(ProcessorSettlement.class).list();
    }

    public Map<String, RowStatus> saveAll(List<ProcessorSettlement> processorSettlementList){
        String sql2 = "MERGE INTO processor_settlement (network_ref, merchant_ref, merchant_id, card_last4, card_type, settled_amount, interchange_fee, processor_fee, currency, settlement_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        String sql = """
                MERGE INTO processor_settlement AS ps
                using (VALUES (:networkRef,
                      :merchantRef,
                      :merchantId,
                      :cardLast4,
                      :cardType,
                      :settledAmount,
                      :interchangeFee,
                      :processorFee,
                      :currency,
                      :settlementDate)) AS src(network_ref, merchant_ref, merchant_id,
                      card_last4, card_type, settled_amount, interchange_fee, processor_fee,
                      currency, settlement_date)
                ON ps.network_ref = src.network_ref
                WHEN NOT matched THEN
                  INSERT (network_ref,
                          merchant_ref,
                          merchant_id,
                          card_last4,
                          card_type,
                          settled_amount,
                          interchange_fee,
                          processor_fee,
                          currency,
                          settlement_date)
                  VALUES (src.network_ref,
                          src.merchant_ref,
                          src.merchant_id,
                          src.card_last4,
                          src.card_type,
                          src.settled_amount,
                          src.interchange_fee,
                          src.processor_fee,
                          src.currency,
                          src.settlement_date)
                """;

        int[] batchUpdateResult = namedParameterJdbcTemplate.batchUpdate(sql, SqlParameterSourceUtils.createBatch(processorSettlementList));

        HashMap<String, RowStatus> batchUpdateMapping = new HashMap<>();
        for(int i=0; i<batchUpdateResult.length; i++){
            ProcessorSettlement ps = processorSettlementList.get(i);
            RowStatus rowStatus;
            if(batchUpdateResult[i] > 0) {
                rowStatus = RowStatus.INSERTED_OR_UPDATED;
            }else{
                rowStatus = RowStatus.NO_CHANGE;
            }

            batchUpdateMapping.put(ps.networkRef(), rowStatus);
        }

        return batchUpdateMapping;
    }
}
