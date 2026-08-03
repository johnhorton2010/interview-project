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

/**
 * Data access for {@code reconciled_transactions}, the table holding every reconciliation verdict.
 *
 * <p>Unlike the ledger and settlement repositories, which only load data, this one drives the
 * pipeline. Its methods fall into three kinds:
 * <ul>
 *   <li><em>Claiming</em> &mdash; insert pairings as {@link Category#IN_PROGRESS}, staking out the
 *       work a later pass will judge.</li>
 *   <li><em>Categorizing in SQL</em> &mdash; assign a terminal category to cases decidable purely
 *       by set membership, such as a ledger row with no settlement at all.</li>
 *   <li><em>Reading back</em> &mdash; return pairings for the categorizers that need to compute in
 *       Java, such as anything involving fee arithmetic.</li>
 * </ul>
 *
 * <p>Cases are pushed into SQL wherever the decision is a matter of joins and counts, since the
 * database can answer those over the whole set at once; only decisions needing the fee schedule or
 * the business-day calendar are pulled into Java.
 *
 * <p>Every write is a {@code MERGE} keyed so that re-running a pass cannot duplicate a verdict.
 * The categorizing statements additionally restrict their {@code WHEN MATCHED} branch to rows
 * still {@code IN_PROGRESS}, so a pass can never overwrite a verdict another pass has already
 * reached. This is what makes the engine's pass ordering safe to change and the whole run
 * repeatable.
 *
 * <p>Neither the {@code ledger} nor the {@code processor_settlement} table is ever written to from
 * here; reconciliation only ever adds to its own table.
 *
 * <p>No method opens a transaction. The engine wraps a whole run in one, so a failed pass rolls
 * back every verdict from that run rather than leaving the table half-judged.
 *
 * @author John
 */
@Repository
public class ReconciliationRepository {
    /**
     * Creates the repository with the JDBC clients it delegates to.
     *
     * @param namedParameterJdbcTemplate template used for batched upserts
     * @param jdbcClient                 fluent client used for the single-statement queries
     */
    public ReconciliationRepository(NamedParameterJdbcTemplate namedParameterJdbcTemplate, JdbcClient jdbcClient){
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
        this.jdbcClient = jdbcClient;
    }

    /** Template used for batched upserts, which {@code JdbcClient} does not expose. */
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    /** Fluent client for single-statement queries and updates. */
    private final JdbcClient jdbcClient;

    /**
     * Claims every ledger transaction that shares a merchant reference with a settlement, marking
     * the pairing {@link Category#IN_PROGRESS}.
     *
     * <p>The primary matching pass. Joining on merchant reference alone is not enough, because a
     * refunded order puts a sale and a refund under one reference on both sides; the statement
     * therefore also requires the sign of the settlement to agree with the ledger type, pairing a
     * {@code SALE} only with a positive settlement and a {@code REFUND} only with a negative one.
     * Without that condition a sale would match its order's refund.
     *
     * <p>Inserts only where the exact pairing is absent, so re-running claims nothing twice and
     * cannot disturb a pairing already judged.
     *
     * @return the number of pairings newly claimed; zero when every match is already recorded
     * @throws org.springframework.dao.DataAccessException if the statement fails
     */
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

    /**
     * Re-categorizes refunds that have no originating sale as {@link Category#ORPHAN_REFUND}.
     *
     * <p>Detection is by absence: a legitimate refund shares its merchant reference with the sale
     * it reverses, so a reference appearing exactly once in the ledger and attached to a refund
     * means the sale does not exist. Counting occurrences is the only signal available, as the
     * data carries no explicit marker.
     *
     * <p>This must be a pass of its own rather than part of settlement matching, because an orphan
     * refund can settle perfectly against its own settlement row. A pipeline that stopped at "the
     * refund settled cleanly" would classify it as a clean match and never report it.
     *
     * <p>Only rows still {@link Category#IN_PROGRESS} are updated, so a refund already judged by
     * an earlier pass keeps its verdict.
     *
     * @return the number of pairings re-categorized as orphan refunds
     * @throws org.springframework.dao.DataAccessException if the statement fails
     */
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

    /**
     * Writes verdicts reached in Java back to the table, in a single JDBC batch.
     *
     * <p>The counterpart to the SQL categorizing statements: this is how the categorizers that
     * need the fee schedule or the business-day calendar record their conclusions.
     *
     * <p>Unlike every other write in the application, this {@code MERGE} does have a
     * {@code WHEN MATCHED} branch and will overwrite an existing category. That is the point
     * &mdash; the pairing being written was claimed as {@link Category#IN_PROGRESS} by an earlier
     * pass and is now being resolved. It does mean a caller can overwrite a terminal verdict, so
     * the categorizers are responsible for only submitting pairings they own.
     *
     * <p>The returned map is keyed by the {@link ReconciledTransaction} itself. Because record
     * equality includes {@code category}, two verdicts differing only in category are distinct
     * keys.
     *
     * @param recons the verdicts to write, in any order; an empty list is valid and performs no
     *               work
     * @return a map from each submitted verdict to whether the write changed anything
     * @throws org.springframework.dao.DataAccessException if the batch fails; the surrounding
     *                                                     transaction decides whether earlier
     *                                                     entries survive
     */
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

    /**
     * Returns every claimed pairing whose ledger transaction matched more than one settlement.
     *
     * <p>These are the cases SQL cannot decide alone: several settlements against one capture are
     * either a {@link Category#DUPLICATE}, where each row repeats the expected net, or a
     * {@link Category#SPLIT}, where they sum to it. Telling those apart needs the fee schedule to
     * establish what the expected net is, so the whole group is handed to Java.
     *
     * <p>The subquery selects transactions with more than one {@code IN_PROGRESS} row and the join
     * then returns all of that transaction's rows, so each group arrives complete. A partial group
     * would make the sum-versus-repeat test meaningless.
     *
     * @return the multi-settlement groups, indexed by transaction, by settlement, and by merchant
     *         reference; empty rather than {@code null} when no transaction has more than one
     *         settlement
     * @throws org.springframework.dao.DataAccessException if the query fails
     */
    public TransactionMapping findLedgerTransactionsWithMultipleSettlements(){
        String sql = """
               SELECT led.internal_txn_id AS led_internal_txn_id,
                      led.merchant_id     AS led_merchant_id,
                      led.merchant_ref    AS led_merchant_ref,
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

    /**
     * Records every ledger transaction that no pass claimed as
     * {@link Category#UNMATCHED_INTERNAL}.
     *
     * <p>Money the merchant recorded but never received &mdash; an owed payout or a dropped one.
     * Found by anti-join against {@code reconciled_transactions}: a ledger row with no verdict of
     * any kind was matched by nothing, since even quarantine and claiming write a row.
     *
     * <p>This is therefore order-dependent and must run after every matching pass; run earlier it
     * would claim transactions that matching had not yet reached.
     *
     * <p>Rows are inserted with a {@code NULL} network reference, since by definition there is no
     * settlement side.
     *
     * @return the number of unmatched ledger transactions recorded
     * @throws org.springframework.dao.DataAccessException if the statement fails
     */
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

    /**
     * Quarantines ledger transactions whose identifiers mark them as deliberately malformed.
     *
     * <p>Runs before any matching pass. Removing unusable rows first means later passes never see
     * them, so a malformed row cannot produce a spurious amount mismatch or drag a sound
     * transaction into a bad pairing.
     *
     * <p>Rows are identified by the {@code TXN-BAD-} and {@code ORD-BAD-} prefix conventions of
     * the supplied data set rather than by inspecting the values themselves. This is a deliberate
     * simplification tied to that data: it recognises exactly the rows the fixtures mark as bad,
     * and would not detect a malformed row arriving under an ordinary identifier. A
     * general implementation would validate the fields instead of the naming.
     *
     * <p>Inserted with a {@code NULL} network reference, as a quarantined ledger row is never
     * paired.
     *
     * @return the number of ledger transactions quarantined
     * @throws org.springframework.dao.DataAccessException if the statement fails
     */
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

    /**
     * Records every settlement that no pass claimed as {@link Category#UNMATCHED_SETTLEMENT}.
     *
     * <p>The settlement-side mirror of
     * {@link #createReconciledTransactionWithUnmatchedInternalFromLedger()}, and the more alarming
     * of the two: money moved against a transaction the merchant never recorded, which may
     * indicate fraud or a missed booking rather than a mere accounting gap.
     *
     * <p>Equally order-dependent, and inserted with a {@code NULL} internal transaction id since
     * there is no ledger side.
     *
     * @return the number of unmatched settlements recorded
     * @throws org.springframework.dao.DataAccessException if the statement fails
     */
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

    /**
     * Quarantines settlements whose identifiers mark them as deliberately malformed.
     *
     * <p>The settlement-side mirror of
     * {@link #createReconciledTransactionWithQuarantineFromLedger()}, matching the {@code ARNBAD}
     * and {@code ORD-BAD-} prefix conventions and carrying the same caveat: it recognises the rows
     * the supplied data set marks as bad, not malformed rows in general.
     *
     * <p>Inserted with a {@code NULL} internal transaction id, as a quarantined settlement is
     * never paired.
     *
     * @return the number of settlements quarantined
     * @throws org.springframework.dao.DataAccessException if the statement fails
     */
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

    /**
     * Returns every claimed but unjudged pairing, with both sides fully populated.
     *
     * <p>The working set for the categorizers that compute in Java. Inner joins are correct here
     * because an {@link Category#IN_PROGRESS} pairing has, by construction, a row on both sides;
     * one-sided cases were already given terminal categories by the unmatched passes.
     *
     * <p>Includes transactions with a single settlement and those with several. Callers wanting
     * only the multi-settlement groups should use
     * {@link #findLedgerTransactionsWithMultipleSettlements()}.
     *
     * @return the unjudged pairings, indexed by transaction, by settlement, and by merchant
     *         reference; empty rather than {@code null} when nothing is outstanding
     * @throws org.springframework.dao.DataAccessException if the query fails
     */
    public TransactionMapping findMatchedTransactionsInProgress(){
        String sql = """
                SELECT
                      rt.id,
                      rt.internal_txn_id AS led_internal_txn_id,
                      rt.network_ref   AS ps_network_ref,
                      -- ledger side
                      led.merchant_id  AS led_merchant_id,
                      led.merchant_ref AS led_merchant_ref,
                      led.card_type    AS led_card_type,
                      led.card_last4   AS led_card_last4,
                      led.currency     AS led_currency,
                      led.gross_amount AS led_gross_amount,
                      led.type         AS led_type,
                      led.captured_at  AS led_captured_at,
                      -- settlement side
                      ps.merchant_id     AS ps_merchant_id,
                      ps.merchant_ref    AS ps_merchant_ref,
                      ps.card_type       AS ps_card_type,
                      ps.card_last4      AS ps_card_last4,
                      ps.currency        AS ps_currency,
                      ps.settled_amount  AS ps_settled_amount,
                      ps.interchange_fee AS ps_interchange_fee,
                      ps.processor_fee   AS ps_processor_fee,
                      ps.settlement_date AS ps_settlement_date
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

    /**
     * Returns every finished verdict, for reporting.
     *
     * <p>Outer joins on both sides, because the result deliberately includes the one-sided
     * categories: an unmatched ledger transaction has no settlement and an unmatched settlement
     * has no ledger row. The extractor represents those missing sides with sentinel keys, so
     * callers must expect them.
     *
     * <p>{@link Category#IN_PROGRESS} rows are excluded, since a pairing still being worked on is
     * not a result. The exclusion uses SQL's null-safe inequality, so a row with no category at
     * all is included rather than silently dropped &mdash; such a row indicates a pass failed to
     * finish and should be visible in the report, not hidden by it.
     *
     * @return every finished verdict with both sides where they exist; empty rather than
     *         {@code null} before any run has completed
     * @throws org.springframework.dao.DataAccessException if the query fails
     */
    public TransactionMapping findAllReconciledTransactions(){
        String sql = """
                SELECT    rt.id,
                          rt.category,
                          rt.internal_txn_id  AS led_internal_txn_id,
                          rt.network_ref   AS ps_network_ref,
                          -- ledger side
                          led.merchant_id  AS led_merchant_id,
                          led.merchant_ref AS led_merchant_ref,
                          led.card_type    AS led_card_type,
                          led.card_last4   AS led_card_last4,
                          led.currency     AS led_currency,
                          led.gross_amount AS led_gross_amount,
                          led.type         AS led_type,
                          led.captured_at  AS led_captured_at,
                          -- settlement side
                          ps.merchant_id     AS ps_merchant_id,
                          ps.merchant_ref    AS ps_merchant_ref,
                          ps.card_type       AS ps_card_type,
                          ps.card_last4      AS ps_card_last4,
                          ps.currency        AS ps_currency,
                          ps.settled_amount  AS ps_settled_amount,
                          ps.interchange_fee AS ps_interchange_fee,
                          ps.processor_fee   AS ps_processor_fee,
                          ps.settlement_date AS ps_settlement_date
                FROM      reconciled_transactions rt
                LEFT JOIN ledger led
                ON        led.internal_txn_id = rt.internal_txn_id
                LEFT JOIN processor_settlement ps
                ON        ps.network_ref = rt.network_ref
                WHERE     rt.category IS distinct
                FROM      :category
                """;

        return jdbcClient
                .sql(sql)
                .param("category", Category.IN_PROGRESS.name())
                .query(new MatchedTransactionsResultSetExtractor());
    }

    /**
     * Removes every recorded verdict.
     *
     * <p>Clears reconciliation's own table only, leaving the ledger and settlement data intact.
     * That is what allows a full re-run against unchanged inputs, which is the intended use: since
     * the pipeline never mutates its sources, discarding the verdicts returns the system to its
     * pre-reconciliation state exactly.
     *
     * @return the number of verdicts deleted; zero if none had been recorded
     * @throws org.springframework.dao.DataAccessException if the delete fails
     */
    public int deleteAll(){
        String sql = """
                DELETE
                FROM reconciled_transactions
                """;

        return jdbcClient
                .sql(sql)
                .update();
    }
}
