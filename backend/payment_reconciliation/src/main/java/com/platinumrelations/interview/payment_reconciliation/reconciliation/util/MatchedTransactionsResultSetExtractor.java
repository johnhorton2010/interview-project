package com.platinumrelations.interview.payment_reconciliation.reconciliation.util;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionPairing;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.sql.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

public class MatchedTransactionsResultSetExtractor implements ResultSetExtractor<TransactionMapping> {

    @Override
    public TransactionMapping extractData(ResultSet rs) throws SQLException, DataAccessException {
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        HashMap<ProcessorSettlement, Set<InternalTransaction>> psToItMap = new HashMap<>();
        HashMap<String, TransactionPairing> merchantRefToTransactionKeysMap = new HashMap<>();

        HashMap<String, InternalTransaction> itCache = new HashMap<>();
        HashMap<String, ProcessorSettlement> psCache = new HashMap<>();

        while (rs.next()){
            String curRowItId = rs.getString("internal_txn_id");
            InternalTransaction internalTransaction = null;
            if(curRowItId != null) {
                InternalTransaction cachedIt = itCache.get(curRowItId);

                if (cachedIt != null) {
                    internalTransaction = cachedIt;
                } else {
                    String categoryStr = retrieveCategoryStrOrNull(rs);

                    Instant capturedAt;
                    Timestamp capturedAtSqlTimestamp = rs.getTimestamp("led_captured_at");
                    if (capturedAtSqlTimestamp == null) {
                        capturedAt = null;
                    } else {
                        capturedAt = capturedAtSqlTimestamp.toInstant();
                    }

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
                            .capturedAt(capturedAt)
                            .category(categoryStr)
                            .build();

                    itCache.put(internalTransaction.getInternalTxnId(), internalTransaction);
                }
            }

            String curRowPsId = rs.getString("network_ref");
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

    private String retrieveCategoryStrOrNull(ResultSet rs){
        try {
            return rs.getString("category");
        } catch (SQLException ex){
            // Category will not always be present in all queries using this resultSetExtractor so returning null is acceptable
            return null;
        }
    }
}
