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

/**
 * Data access for the {@code processor_settlement} table.
 *
 * <p>Mirrors {@code LedgerRepository} in structure and in policy: plain SQL over Spring's JDBC
 * clients, insert-only merges, and no transaction boundary of its own. The two repositories are
 * kept separate rather than generified because the reconciliation queries they support diverge,
 * and because each side's table is loaded through a different transport.
 *
 * @author John
 */
@Repository
public class ProcessorSettlementRepository {

    /**
     * Creates the repository with the JDBC clients it delegates to.
     *
     * @param namedParameterJdbcTemplate template used for batched upserts
     * @param jdbcClient                 fluent client used for the single-statement queries
     */
    public ProcessorSettlementRepository(NamedParameterJdbcTemplate namedParameterJdbcTemplate, JdbcClient jdbcClient){
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
        this.jdbcClient = jdbcClient;
    }

    /** Template used for batched upserts, which {@code JdbcClient} does not expose. */
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    /** Fluent client for single-statement queries and updates. */
    private final JdbcClient jdbcClient;

    /**
     * Finds settlements that arrived without a usable merchant reference.
     *
     * <p>These are the settlements the primary matching pass cannot touch, since it joins on
     * {@code merchant_ref}. Blank is treated as equivalent to {@code NULL} because an exporter
     * that writes an empty column and one that omits it express the same absence, and only one of
     * those would otherwise be caught.
     *
     * @return the unmatched-by-reference settlements; empty rather than {@code null} when every
     *         settlement carries a reference
     * @throws org.springframework.dao.DataAccessException if the query fails
     */
    public List<ProcessorSettlement> findNullOrEmptyMerchantRefSettlements(){
        String sql = """
                SELECT *
                FROM   processor_settlement
                WHERE  merchant_ref IS NULL
                        OR Trim(merchant_ref) = ''
                """;

        return jdbcClient.sql(sql).query(ProcessorSettlement.class).list();
    }

    /**
     * Inserts every supplied settlement that is not already stored, in a single JDBC batch.
     *
     * <p>As with the ledger, the {@code MERGE} has only a {@code WHEN NOT MATCHED} branch, so an
     * existing {@code network_ref} is left untouched rather than overwritten. A processor
     * re-sending a corrected figure therefore cannot silently rewrite a settlement that has
     * already been reconciled against.
     *
     * <p>{@code category} is not part of the statement; it belongs to
     * {@code reconciled_transactions} and is never set by an upload.
     *
     * <p>The returned map is keyed by {@code networkRef}, so repeated references within one
     * request collapse to a single entry reflecting the last one processed.
     *
     * @param processorSettlementList settlements to store, in request order; an empty list is
     *                                valid and performs no work
     * @return a map from {@code networkRef} to whether that row was written or already present
     * @throws org.springframework.dao.DataAccessException if the batch fails; the surrounding
     *                                                     transaction, if any, decides whether
     *                                                     earlier entries survive
     */
    public Map<String, RowStatus> saveAll(List<ProcessorSettlement> processorSettlementList){
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

            batchUpdateMapping.put(ps.getNetworkRef(), rowStatus);
        }

        return batchUpdateMapping;
    }

    /**
     * Removes every row from the {@code processor_settlement} table.
     *
     * <p>Intended for resetting between runs against a fresh data set. It clears only the
     * settlements; the ledger and previously recorded reconciliation results are untouched.
     *
     * @return the number of rows deleted; zero if the table was already empty
     * @throws org.springframework.dao.DataAccessException if the delete fails, including when a
     *                                                     foreign key still references a settlement
     */
    public int deleteAll(){
        String sql = """
                DELETE
                FROM processor_settlement
                """;

        return jdbcClient
                .sql(sql)
                .update();
    }
}
