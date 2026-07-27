package com.platinumrelations.interview.payment_reconciliation.reconciliation.util;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionPairing;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;

public class MatchedTransactionsResultSetExtractor implements ResultSetExtractor<TransactionMapping> {

    @Override
    public TransactionMapping extractData(ResultSet rs) throws SQLException, DataAccessException {
        HashMap<InternalTransaction, Set<ProcessorSettlement>> itToPsMap = new HashMap<>();
        HashMap<ProcessorSettlement, Set<InternalTransaction>> psToItMap = new HashMap<>();
        HashMap<String, TransactionPairing> orderRefToTransactionKeysMap = new HashMap<>();

        HashMap<String, InternalTransaction> itCache = new HashMap<>();
        HashMap<String, ProcessorSettlement> psCache = new HashMap<>();

        while (rs.next()){
            String curRowItId = rs.getString("internal_txn_id");
            InternalTransaction cachedIt = itCache.get(curRowItId);

            InternalTransaction internalTransaction;
            if(cachedIt != null){
                internalTransaction = cachedIt;
            }else {
                internalTransaction = InternalTransaction
                        .builder()
                        .internalTxnId(curRowItId)
                        .merchantId(rs.getString("merchant_id"))
                        .merchantRef(rs.getString("merchant_ref"))
                        .cardType(rs.getString("card_type"))
                        .cardLast4(rs.getShort("card_last4"))
                        .grossAmount(rs.getBigDecimal("gross_amount"))
                        .currency(rs.getString("currency"))
                        .type(rs.getString("type"))
                        .capturedAt(rs.getTimestamp("captured_at").toInstant())
                        .build();

                itCache.put(internalTransaction.internalTxnId(), internalTransaction);
            }

            String curRowPsId = rs.getString("network_ref");
            ProcessorSettlement cachedPs = psCache.get(curRowPsId);

            ProcessorSettlement processorSettlement;
            if(cachedPs != null){
                processorSettlement = cachedPs;
            }else {
                processorSettlement = ProcessorSettlement
                        .builder()
                        .networkRef(curRowPsId)
                        .merchantRef(rs.getString("merchant_ref"))
                        .merchantId(rs.getString("merchant_id"))
                        .cardLast4(rs.getShort("card_last4"))
                        .cardType(rs.getString("card_type"))
                        .settledAmount(rs.getBigDecimal("settled_amount"))
                        .interchangeFee(rs.getBigDecimal("interchange_fee"))
                        .processorFee(rs.getBigDecimal("processor_fee"))
                        .currency(rs.getString("currency"))
                        .settlementDate(rs.getDate("settlement_date").toLocalDate())
                        .build();

                psCache.put(processorSettlement.networkRef(), processorSettlement);
            }

            orderRefToTransactionKeysMap.computeIfAbsent(internalTransaction.merchantRef(), it -> new TransactionPairing()).getInternalTransactions().add(internalTransaction);
            orderRefToTransactionKeysMap.get(internalTransaction.merchantRef()).getProcessorSettlements().add(processorSettlement);

            itToPsMap.computeIfAbsent(internalTransaction, it -> new HashSet<>()).add(processorSettlement);
            psToItMap.computeIfAbsent(processorSettlement, ps -> new HashSet<>()).add(internalTransaction);
        }

        return new TransactionMapping(itToPsMap, psToItMap, orderRefToTransactionKeysMap);
    }
}
