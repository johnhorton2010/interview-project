package com.platinumrelations.interview.payment_reconciliation.reconciliation.util;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionPairing;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.sql.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;

/**
 * Collapses a flat join result into the three indexed views of {@link TransactionMapping}.
 *
 * <p>A join between the ledger and the settlement feed repeats the ledger columns once per matched
 * settlement, so the same logical transaction appears on many rows. This extractor reads the whole
 * result set once, rebuilds each distinct transaction and settlement exactly once, and links them
 * into all three views. Doing it in a single pass is why the categorizers can ask three different
 * questions without three queries.
 *
 * <p>Identity caches keyed by identifier are what guarantee one instance per logical row. That
 * matters beyond allocation: the resulting objects are used directly as map keys and set members,
 * so sharing one instance keeps the views internally consistent.
 *
 * <p>Written to tolerate either side being absent, because outer-joined queries use it to find
 * transactions with no settlement and settlements with no transaction.
 *
 * <p>Stateless between calls and therefore reusable, though a single invocation is not
 * thread-safe with respect to the {@link ResultSet} it is given.
 *
 * @author John
 */
public class MatchedTransactionsResultSetExtractor implements ResultSetExtractor<TransactionMapping> {

    /**
     * Reads the entire result set and builds the three views.
     *
     * <p>Rows are expected to carry ledger columns prefixed {@code led_} and settlement columns
     * prefixed {@code ps_}; the prefixes exist because both sides contribute same-named columns to
     * the join. A {@code category} column is optional and is picked up when the query supplies it.
     *
     * <p>When one side of a row is absent, that side is indexed under a sentinel object whose
     * identifier is the literal string {@code "null"}, and the absent counterpart is added to the
     * value set as {@code null}. Callers reading the by-transaction or by-settlement views must
     * therefore expect a sentinel key and {@code null} members; the by-merchant-reference view
     * does not use sentinels and omits the missing side instead.
     *
     * @param rs the result set to consume, positioned before the first row; fully read by this
     *           method
     * @return the three views of the matched data; all three maps are empty rather than
     *         {@code null} when the result set has no rows
     * @throws SQLException        if a column cannot be read, other than the optional
     *                             {@code category} column whose absence is tolerated
     * @throws DataAccessException if the underlying access fails
     */
    @Override
    public TransactionMapping extractData(ResultSet rs) throws SQLException, DataAccessException {
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        HashMap<ProcessorSettlement, Set<InternalTransaction>> psToItMap = new HashMap<>();
        HashMap<String, TransactionPairing> merchantRefToTransactionKeysMap = new HashMap<>();

        HashMap<String, InternalTransaction> itCache = new HashMap<>();
        HashMap<String, ProcessorSettlement> psCache = new HashMap<>();

        while (rs.next()){
            String curRowItId = rs.getString("led_internal_txn_id");
            InternalTransaction internalTransaction = null;
            if(curRowItId != null) {
                InternalTransaction cachedIt = itCache.get(curRowItId);

                if (cachedIt != null) {
                    internalTransaction = cachedIt;
                } else {
                    String categoryStr = retrieveCategoryStrOrNull(rs);

                    internalTransaction = InternalTransaction
                            .builder()
                            .internalTxnId(curRowItId)
                            .merchantId(rs.getString("led_merchant_id"))
                            .merchantRef(rs.getString("led_merchant_ref"))
                            .cardType(rs.getString("led_card_type"))
                            .cardLast4(rs.getString("led_card_last4"))
                            .grossAmount(rs.getBigDecimal("led_gross_amount"))
                            .currency(rs.getString("led_currency"))
                            .type(rs.getString("led_type"))
                            .capturedAt(rs.getObject("led_captured_at", OffsetDateTime.class))
                            .category(categoryStr)
                            .build();

                    itCache.put(internalTransaction.getInternalTxnId(), internalTransaction);
                }
            }

            String curRowPsId = rs.getString("ps_network_ref");
            ProcessorSettlement processorSettlement = null;
            if(curRowPsId != null) {
                ProcessorSettlement cachedPs = psCache.get(curRowPsId);

                if (cachedPs != null) {
                    processorSettlement = cachedPs;
                } else {
                    String categoryStr = retrieveCategoryStrOrNull(rs);

                    LocalDate settlementDate;
                    Date settlementSqlDate = rs.getDate("ps_settlement_date");
                    if (settlementSqlDate == null) {
                        settlementDate = null;
                    } else {
                        settlementDate = settlementSqlDate.toLocalDate();
                    }

                    processorSettlement = ProcessorSettlement
                            .builder()
                            .networkRef(curRowPsId)
                            .merchantRef(rs.getString("ps_merchant_ref"))
                            .merchantId(rs.getString("ps_merchant_id"))
                            .cardLast4(rs.getString("ps_card_last4"))
                            .cardType(rs.getString("ps_card_type"))
                            .settledAmount(rs.getBigDecimal("ps_settled_amount"))
                            .interchangeFee(rs.getBigDecimal("ps_interchange_fee"))
                            .processorFee(rs.getBigDecimal("ps_processor_fee"))
                            .currency(rs.getString("ps_currency"))
                            .settlementDate(settlementDate)
                            .category(categoryStr)
                            .build();

                    psCache.put(processorSettlement.getNetworkRef(), processorSettlement);
                }
            }

            // merchantRefToTransactionKeysMap
            if(internalTransaction != null) {
                merchantRefToTransactionKeysMap.computeIfAbsent(internalTransaction.getMerchantRef(), it -> new TransactionPairing()).getInternalTransactions().add(internalTransaction);

                if(processorSettlement != null) {
                    merchantRefToTransactionKeysMap.computeIfAbsent(internalTransaction.getMerchantRef(), it -> new TransactionPairing()).getProcessorSettlements().add(processorSettlement);
                }
            }else if(processorSettlement != null){
                merchantRefToTransactionKeysMap.computeIfAbsent(processorSettlement.getMerchantRef(), it -> new TransactionPairing()).getProcessorSettlements().add(processorSettlement);
            }

            // itToPsMap
            if(internalTransaction != null) {
                itToPsMap.computeIfAbsent(internalTransaction, it -> new HashSet<>()).add(processorSettlement);
            }else {
                itToPsMap.computeIfAbsent(InternalTransaction.builder().internalTxnId("null").build(), it -> new HashSet<>()).add(processorSettlement);
            }

            // psToItMap
            if(processorSettlement != null) {
                psToItMap.computeIfAbsent(processorSettlement, ps -> new HashSet<>()).add(internalTransaction);
            }else{
                psToItMap.computeIfAbsent(ProcessorSettlement.builder().networkRef("null").build(), ps -> new HashSet<>()).add(internalTransaction);
            }
        }

        return new TransactionMapping(itToPsMap, psToItMap, merchantRefToTransactionKeysMap);
    }

    /**
     * Reads the optional {@code category} column, yielding {@code null} when the query did not
     * select it.
     *
     * <p>The same extractor serves queries that join against recorded outcomes and queries that do
     * not, so a missing column is an expected condition rather than an error. It is detected by
     * catching the resulting {@link SQLException}, since {@link ResultSet} offers no way to test
     * for a column's presence without inspecting the metadata.
     *
     * @param rs the result set, positioned on the row being read
     * @return the category name, or {@code null} if the column is absent or SQL {@code NULL}
     */
    private String retrieveCategoryStrOrNull(ResultSet rs){
        try {
            return rs.getString("category");
        } catch (SQLException ex){
            // Category will not always be present in all queries using this resultSetExtractor so returning null is acceptable
            return null;
        }
    }
}
