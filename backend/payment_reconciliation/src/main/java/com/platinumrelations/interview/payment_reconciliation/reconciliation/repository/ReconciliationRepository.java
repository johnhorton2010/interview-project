package com.platinumrelations.interview.payment_reconciliation.reconciliation.repository;

import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.Type;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.Category;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.ReconciledTransaction;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.util.MatchedTransactionsResultSetExtractor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.jdbc.core.namedparam.SqlParameterSourceUtils;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
public class ReconciliationRepository {
    public ReconciliationRepository(NamedParameterJdbcTemplate namedParameterJdbcTemplate, JdbcClient jdbcClient){
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
        this.jdbcClient = jdbcClient;
    }

    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final JdbcClient jdbcClient;

    public int createReconciledTransactionWithMatchBasedExactMerchantRef(){
        String sql = """
               MERGE INTO reconciled_transactions AS rt
               using (SELECT internal_txn_id,
                             network_ref
                      FROM   ledger AS led
                             INNER JOIN processor_settlement AS ps
                                     ON led.merchant_ref = ps.merchant_ref
                      WHERE  ( led.type = :typeIsSale
                               AND ps.settled_amount > 0 )
                              OR ( led.type = :typeIsRefund
                                   AND ps.settled_amount < 0 )) AS src
               ON rt.internal_txn_id = src.internal_txn_id
                  AND rt.network_ref = src.network_ref
               WHEN NOT matched THEN
                 INSERT (internal_txn_id,
                         network_ref,
                         category)
                 VALUES (src.internal_txn_id,
                         src.network_ref,
                         :category)
               """;

        return jdbcClient
                .sql(sql)
                .param("category", Category.IN_PROGRESS.name())
                .param("typeIsSale", Type.SALE.name())
                .param("typeIsRefund", Type.REFUND.name())
                .update();
    }

    public int createReconciledTransactionWithOrphanRefundFromLedger(){
        String sql = """
                  MERGE INTO reconciled_transactions AS rt
                  using (SELECT led.internal_txn_id
                         FROM   ledger AS led
                                JOIN (SELECT merchant_ref
                                      FROM   ledger
                                      GROUP  BY merchant_ref
                                      HAVING Count(*) = 1) AS subquery
                                  ON subquery.merchant_ref = led.merchant_ref
                         WHERE  led.type = :typeIsRefund) AS src
                  ON rt.internal_txn_id = src.internal_txn_id
                  WHEN matched AND rt.category = :filterOnInProgress THEN
                    UPDATE SET category = :category
                """;

        return jdbcClient
                .sql(sql)
                .param("category", Category.ORPHAN_REFUND.name())
                .param("typeIsRefund", Type.REFUND.name())
                .param("filterOnInProgress", Category.IN_PROGRESS.name())
                .update();
    }

    public Map<ReconciledTransaction, RowStatus> saveAll(List<ReconciledTransaction> recons){
        String sql = """
                MERGE INTO reconciled_transactions AS rt
                using (VALUES(:internalTxnId,
                      :networkRef,
                      :category)) AS src(internal_txn_id, network_ref, category)
                ON rt.internal_txn_id = src.internal_txn_id
                   AND rt.network_ref = src.network_ref
                WHEN MATCHED THEN
                  UPDATE SET internal_txn_id = src.internal_txn_id, network_ref = src.network_ref, category = src.category
                WHEN NOT matched THEN
                  INSERT (internal_txn_id,
                          network_ref,
                          category)
                  VALUES (src.internal_txn_id,
                          src.network_ref,
                          src.category)
                """;

        SqlParameterSource[] batchArgs = SqlParameterSourceUtils.createBatch(recons);
        int[] batchUpdateResult = namedParameterJdbcTemplate.batchUpdate(sql, batchArgs);

        HashMap<ReconciledTransaction, RowStatus> batchUpdateMapping = new HashMap<>();
        for(int i=0; i<batchUpdateResult.length; i++){
            ReconciledTransaction recon = recons.get(i);
            RowStatus rowStatus;
            if(batchUpdateResult[i] > 0) {
                rowStatus = RowStatus.INSERTED_OR_UPDATED;
            }else{
                rowStatus = RowStatus.NO_CHANGE;
            }

            batchUpdateMapping.put(recon, rowStatus);
        }

        return batchUpdateMapping;
    }

    public TransactionMapping findLedgerTransactionsWithMultipleSettlements(){
        String sql = """
               SELECT led.internal_txn_id AS led_internal_txn_id,
                      led.merchant_id     AS led_merchant_id,
                      led.merchant_ref    AS led_mechant_ref,
                      led.card_type       AS led_card_type,
                      led.card_last4      AS led_card_last4,
                      led.gross_amount    AS led_gross_amount,
                      led.currency        AS led_currency,
                      led.type            AS led_type,
                      led.captured_at     AS led_captured_at,
                      ps.network_ref      AS ps_network_ref,
                      ps.merchant_ref     AS ps_merchant_ref,
                      ps.merchant_id      AS ps_merchant_id,
                      ps.card_last4       AS ps_card_last4,
                      ps.card_type        AS ps_card_type,
                      ps.settled_amount   AS ps_settled_amount,
                      ps.interchange_fee  AS ps_interchange_fee,
                      ps.processor_fee    AS ps_processor_fee,
                      ps.currency         AS ps_currency,
                      ps.settlement_date  AS ps_settlement_date
               FROM   (SELECT internal_txn_id
                       FROM   reconciled_transactions
                       WHERE  category = :category
                       GROUP  BY internal_txn_id
                       HAVING Count(*) > 1) AS subquery
                      JOIN reconciled_transactions rt
                        ON rt.internal_txn_id = subquery.internal_txn_id
                      JOIN ledger led
                        ON led.internal_txn_id = rt.internal_txn_id
                      JOIN processor_settlement ps
                        ON ps.network_ref = rt.network_ref
               """;

        return jdbcClient.sql(sql).param("category", Category.IN_PROGRESS.name()).query(new MatchedTransactionsResultSetExtractor());
    }

    public int createReconciledTransactionWithUnmatchedInternalFromLedger(){
        String sql = """
                        MERGE INTO reconciled_transactions AS rt
                        using (SELECT led.internal_txn_id
                               FROM   ledger AS led
                                      LEFT JOIN reconciled_transactions AS rt
                                             ON led.internal_txn_id = rt.internal_txn_id
                               WHERE  rt.internal_txn_id IS NULL) AS src
                        ON rt.internal_txn_id = src.internal_txn_id
                        WHEN NOT matched THEN
                          INSERT (internal_txn_id,
                                  network_ref,
                                  category)
                          VALUES (src.internal_txn_id,
                                  NULL,
                                  :category)
                """;

        return jdbcClient
                .sql(sql)
                .param("category", Category.UNMATCHED_INTERNAL.name())
                .update();
    }

    public int createReconciledTransactionWithQuarantineFromLedger(){
        String sql = """
                MERGE INTO reconciled_transactions AS rt
                   using (SELECT internal_txn_id
                          FROM   ledger
                          WHERE  internal_txn_id LIKE 'TXN-BAD-%'
                                  OR merchant_ref LIKE 'ORD-BAD-%') AS src
                   ON rt.internal_txn_id = src.internal_txn_id
                   WHEN NOT matched THEN
                     INSERT (internal_txn_id,
                             network_ref,
                             category)
                     VALUES (src.internal_txn_id,
                             NULL,
                             :category)
                """;

        return jdbcClient
                .sql(sql)
                .param("category", Category.QUARANTINE.name())
                .update();
    }

    public int createReconciledTransactionWithUnmatchedSettlementFromProcessorSettlement(){
        String sql = """
                    MERGE INTO reconciled_transactions AS rt
                    using (SELECT ps.network_ref
                           FROM   processor_settlement AS ps
                                  LEFT JOIN reconciled_transactions AS rt
                                         ON ps.network_ref = rt.network_ref
                           WHERE  rt.network_ref IS NULL) AS src
                    ON rt.network_ref = src.network_ref
                    WHEN NOT matched THEN
                      INSERT (internal_txn_id,
                              network_ref,
                              category)
                      VALUES (NULL,
                              src.network_ref,
                              :category)
                """;

        return jdbcClient.sql(sql).param("category", Category.UNMATCHED_SETTLEMENT.name()).update();
    }

    public int createReconciledTransactionWithQuarantineFromProcessorSettlement(){
        String sql = """
                    MERGE INTO reconciled_transactions AS rt
                   using (SELECT network_ref
                          FROM   processor_settlement
                          WHERE  network_ref LIKE 'ARNBAD%'
                                  OR merchant_ref LIKE 'ORD-BAD-%') AS src
                   ON rt.network_ref = src.network_ref
                   WHEN NOT matched THEN
                     INSERT (internal_txn_id,
                             network_ref,
                             category)
                     VALUES (NULL,
                             src.network_ref,
                             :category)
                """;

        return jdbcClient
                .sql(sql)
                .param("category", Category.QUARANTINE.name())
                .update();
    }

    public TransactionMapping findMatchedTransactionsInProgress(){
        String sql = """
                SELECT *
                FROM   ledger AS led
                       INNER JOIN reconciled_transactions AS rt
                               ON led.internal_txn_id = rt.internal_txn_id
                       INNER JOIN processor_settlement AS ps
                               ON ps.network_ref = rt.network_ref
                WHERE  category = :category
                """;

        return jdbcClient
                .sql(sql)
                .param("category", Category.IN_PROGRESS.name())
                .query(new MatchedTransactionsResultSetExtractor());
    }
}
