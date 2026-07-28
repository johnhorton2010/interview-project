package com.platinumrelations.interview.payment_reconciliation.ledger.repository;

import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.util.MatchedTransactionsResultSetExtractor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSourceUtils;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
public class LedgerRepository {

    public LedgerRepository(JdbcClient jdbcClient, NamedParameterJdbcTemplate namedParameterJdbcTemplate){
        this.jdbcClient = jdbcClient;
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
    }

    private final JdbcClient jdbcClient;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public TransactionMapping findByBackupIdentification(){
        String sql = """
                SELECT *
                FROM   processor_settlement AS ps
                       JOIN ledger AS led
                         ON ps.merchant_id = led.merchant_id
                            AND ps.card_last4 = led.card_last4
                            AND ps.card_type = led.card_type
                WHERE  ( ps.merchant_ref IS NULL
                          OR Trim(ps.merchant_ref) = '' )
                       AND NOT EXISTS (SELECT 1
                                       FROM   reconciled_transactions AS rt
                                       WHERE  rt.network_ref = ps.network_ref)
                """;

        return jdbcClient
                .sql(sql)
                .query(new MatchedTransactionsResultSetExtractor());
    }

    public Map<String, RowStatus> saveAll(List<InternalTransaction> internalTransactionList){
        String sql = """
                MERGE INTO ledger AS led
                using (VALUES (:internalTxnId,
                      :merchantId,
                      :merchantRef,
                      :cardType,
                      :cardLast4,
                      :grossAmount,
                      :currency,
                      :type,
                      :capturedAt)) AS src (internal_txn_id, merchant_id, merchant_ref,
                      card_type, card_last4, gross_amount, currency, type, captured_at)
                ON led.internal_txn_id = src.internal_txn_id
                WHEN NOT matched THEN
                  INSERT (internal_txn_id,
                          merchant_id,
                          merchant_ref,
                          card_type,
                          card_last4,
                          gross_amount,
                          currency,
                          type,
                          captured_at)
                  VALUES (src.internal_txn_id,
                          src.merchant_id,
                          src.merchant_ref,
                          src.card_type,
                          src.card_last4,
                          src.gross_amount,
                          src.currency,
                          src.type,
                          src.captured_at)
                """;

        int[] batchUpdateResult = namedParameterJdbcTemplate.batchUpdate(sql, SqlParameterSourceUtils.createBatch(internalTransactionList));

        HashMap<String, RowStatus> batchUpdateMapping = new HashMap<>();
        for(int i=0; i<batchUpdateResult.length; i++){
            InternalTransaction it = internalTransactionList.get(i);
            RowStatus rowStatus;
            if(batchUpdateResult[i] > 0) {
                rowStatus = RowStatus.INSERTED_OR_UPDATED;
            }else{
                rowStatus = RowStatus.NO_CHANGE;
            }

            batchUpdateMapping.put(it.getInternalTxnId(), rowStatus);
        }

        return batchUpdateMapping;
    }
}
