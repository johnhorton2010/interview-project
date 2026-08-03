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

/**
 * Data access for the {@code ledger} table.
 *
 * <p>Uses plain SQL through {@link JdbcClient} and {@link NamedParameterJdbcTemplate} rather than
 * an ORM, because the reconciliation queries are set-oriented joins and merges whose shape matters
 * more than object mapping.
 *
 * <p>Two clients are held rather than one: {@code JdbcClient} covers the single-statement calls,
 * while {@code NamedParameterJdbcTemplate} is needed for {@code batchUpdate}, which is what makes
 * a whole uploaded file one round trip instead of one per row.
 *
 * <p>No method opens a transaction; callers supply the boundary.
 *
 * @author John
 */
@Repository
public class LedgerRepository {

    /**
     * Creates the repository with the JDBC clients it delegates to.
     *
     * @param jdbcClient                 fluent client used for the single-statement queries
     * @param namedParameterJdbcTemplate template used for batched upserts
     */
    public LedgerRepository(JdbcClient jdbcClient, NamedParameterJdbcTemplate namedParameterJdbcTemplate){
        this.jdbcClient = jdbcClient;
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
    }

    /** Fluent client for single-statement queries and updates. */
    private final JdbcClient jdbcClient;
    /** Template used for batched upserts, which {@code JdbcClient} does not expose. */
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    /**
     * Finds candidate pairings for settlements that arrived without a usable merchant reference.
     *
     * <p>This is the fallback matching pass. When a settlement carries no {@code merchant_ref} the
     * direct join is impossible, so the transaction is instead identified by the combination of
     * merchant, card type, and last four digits &mdash; a weaker signal that can legitimately match
     * several ledger rows, which is why the result is a mapping of candidates rather than a
     * resolved pairing.
     *
     * <p>Settlements already present in {@code reconciled_transactions} are excluded, so the query
     * only ever proposes work that has not been decided. It is therefore safe to re-run and will
     * not reopen a settled pairing.
     *
     * @return every candidate pairing, indexed in both directions and by merchant reference; empty
     *         rather than {@code null} when nothing qualifies
     */
    public TransactionMapping findByBackupIdentification(){
        String sql = """
                SELECT
                          led.internal_txn_id AS led_internal_txn_id,
                          led.merchant_id  AS led_merchant_id,
                          led.merchant_ref AS led_merchant_ref,
                          led.card_type    AS led_card_type,
                          led.card_last4   AS led_card_last4,
                          led.currency     AS led_currency,
                          led.gross_amount AS led_gross_amount,
                          led.type         AS led_type,
                          led.captured_at  AS led_captured_at,
                          -- settlement side
                          ps.network_ref     AS ps_network_ref,
                          ps.merchant_id     AS ps_merchant_id,
                          ps.merchant_ref    AS ps_merchant_ref,
                          ps.card_type       AS ps_card_type,
                          ps.card_last4      AS ps_card_last4,
                          ps.currency        AS ps_currency,
                          ps.settled_amount  AS ps_settled_amount,
                          ps.interchange_fee AS ps_interchange_fee,
                          ps.processor_fee   AS ps_processor_fee,
                          ps.settlement_date AS ps_settlement_date
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

    /**
     * Inserts every supplied transaction that is not already stored, in a single JDBC batch.
     *
     * <p>The {@code MERGE} has only a {@code WHEN NOT MATCHED} branch, so an existing
     * {@code internal_txn_id} is left exactly as it is rather than being overwritten. This makes
     * re-uploading a file harmless and, more importantly, prevents a later corrected export from
     * silently rewriting history under transactions that have already been reconciled.
     *
     * <p>{@code category} is not part of the statement; it belongs to
     * {@code reconciled_transactions} and is never set by an upload.
     *
     * <p>Per-row status is derived from each batch entry's affected-row count, which is why the
     * result is positional: the returned map is keyed by {@code internalTxnId}, so duplicate ids
     * within one file collapse to a single entry reflecting the last one processed.
     *
     * @param internalTransactionList transactions to store, in the order parsed from the upload;
     *                                an empty list is valid and performs no work
     * @return a map from {@code internalTxnId} to whether that row was written or already present
     * @throws org.springframework.dao.DataAccessException if the batch fails; the surrounding
     *                                                     transaction, if any, decides whether
     *                                                     earlier entries survive
     */
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

    /**
     * Removes every row from the {@code ledger} table.
     *
     * <p>Intended for resetting between runs against a fresh data set. It clears only the ledger;
     * settlements and previously recorded reconciliation results are untouched, so callers wanting
     * a clean slate must clear those separately.
     *
     * @return the number of rows deleted; zero if the table was already empty
     * @throws org.springframework.dao.DataAccessException if the delete fails, including when a
     *                                                     foreign key still references a ledger row
     */
    public int deleteAll(){
        String sql = """
                DELETE
                FROM ledger
                """;

        return jdbcClient
                .sql(sql)
                .update();
    }
}
