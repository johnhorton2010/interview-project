package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.Category;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.ReconciledTransaction;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest()
@Transactional
public class ReconciliationEngineWithDatabaseTest {

    @Autowired
    ReconciliationEngine reconciliationEngine;

    @Autowired
    JdbcClient jdbcClient;

    @Test
    @DisplayName("Verify expected results by using known test data")
    void verifyExpectedResults(){

        reconciliationEngine.reconcile();

        String sql = """
                SELECT *
                FROM   RECONCILED_TRANSACTIONS;
                """;

        List<ReconciledTransaction> reconciledTransactionList = jdbcClient
                .sql(sql)
                .query(ReconciledTransaction.class)
                .list();

        validateQuarantineCategory(reconciledTransactionList);
        validateAmountMismatchCategory(reconciledTransactionList);
        validateFeeDiscrepancyCategory(reconciledTransactionList);
        validateDuplicateCategory(reconciledTransactionList);
        validateSplitCategory(reconciledTransactionList);
        validateWideWindowCategory(reconciledTransactionList);
        validateUnmatchedInternalCategory(reconciledTransactionList);
        validateUnmatchedSettlementCategory(reconciledTransactionList);
        validateOrphanRefundCategory(reconciledTransactionList);
        validateCleanMatchCategory(reconciledTransactionList);
        validateInProgressCategory(reconciledTransactionList);
        validateNoNullCategory(reconciledTransactionList);

        //Validate the total rows in RECONCILED_TRANSACTIONS table is correct
        assertEquals(23, reconciledTransactionList.size());
    }

    private void validateQuarantineCategory(List<ReconciledTransaction> reconList){
        //5 total quarantine (3 ledger, 2 processor settlement)
        assertEquals(3, reconList
                .stream()
                .filter(reconciledTransaction -> Category.QUARANTINE.name().equals(reconciledTransaction.category()) && reconciledTransaction.networkRef() == null)
                .count());

        assertEquals(2, reconList
                .stream()
                .filter(reconciledTransaction -> Category.QUARANTINE.name().equals(reconciledTransaction.category()) && reconciledTransaction.internalTxnId() == null)
                .count());

        //Check that the specific entries are correct
        List<ReconciledTransaction> quarantineLedgerList = new ArrayList<>();
        quarantineLedgerList.add(new ReconciledTransaction("TXN-BAD-001", null, Category.QUARANTINE.name()));
        quarantineLedgerList.add(new ReconciledTransaction("TXN-BAD-002", null, Category.QUARANTINE.name()));
        quarantineLedgerList.add(new ReconciledTransaction("TXN-BAD-003", null, Category.QUARANTINE.name()));
        assertTrue(reconList.containsAll(quarantineLedgerList));

        List<ReconciledTransaction> quarantineProcessorSettlementList = new ArrayList<>();
        quarantineProcessorSettlementList.add(new ReconciledTransaction(null, "ARNBAD0000000000001", Category.QUARANTINE.name()));
        quarantineProcessorSettlementList.add(new ReconciledTransaction(null, "ARNBAD0000000000002", Category.QUARANTINE.name()));
        assertTrue(reconList.containsAll(quarantineProcessorSettlementList));
    }

    private void validateAmountMismatchCategory(List<ReconciledTransaction> reconList){
        //check total
        assertEquals(1, reconList
                .stream()
                .filter(reconciledTransaction -> Category.AMOUNT_MISMATCH.name().equals(reconciledTransaction.category()))
                .count());

        //check that the right transaction matched
        assertTrue(reconList.contains(new ReconciledTransaction("TXN-000010", "ARN74000000000000036173", Category.AMOUNT_MISMATCH.name())));
    }

    private void validateFeeDiscrepancyCategory(List<ReconciledTransaction> reconList) {
        //check total
        assertEquals(1, reconList
                .stream()
                .filter(reconciledTransaction -> Category.FEE_DISCREPANCY.name().equals(reconciledTransaction.category()))
                .count());

        //check that the right transaction matched
        assertTrue(reconList.contains(new ReconciledTransaction("TXN-000011", "ARN74000000000000052411", Category.FEE_DISCREPANCY.name())));
    }

    private void validateDuplicateCategory(List<ReconciledTransaction> reconList){
        //check total
        assertEquals(2, reconList
                .stream()
                .filter(reconciledTransaction -> Category.DUPLICATE.name().equals(reconciledTransaction.category()))
                .count());

        //check that the right transaction matched
        assertTrue(reconList.contains(new ReconciledTransaction("TXN-000012", "ARN74000000000000078631", Category.DUPLICATE.name())));
        assertTrue(reconList.contains(new ReconciledTransaction("TXN-000012", "ARN74000000000000010991", Category.DUPLICATE.name())));
    }

    private void validateSplitCategory(List<ReconciledTransaction> reconList){
        //check total
        assertEquals(2, reconList
                .stream()
                .filter(reconciledTransaction -> Category.SPLIT.name().equals(reconciledTransaction.category()))
                .count());

        //check that the right transaction matched
        assertTrue(reconList.contains(new ReconciledTransaction("TXN-000015", "ARN74000000000000075688", Category.SPLIT.name())));
        assertTrue(reconList.contains(new ReconciledTransaction("TXN-000015", "ARN74000000000000088600", Category.SPLIT.name())));
    }

    private void validateWideWindowCategory(List<ReconciledTransaction> reconList) {
        //check total
        assertEquals(1, reconList
                .stream()
                .filter(reconciledTransaction -> Category.WIDE_WINDOW.name().equals(reconciledTransaction.category()))
                .count());

        //check that the right transaction matched
        assertTrue(reconList.contains(new ReconciledTransaction("TXN-000014", "ARN74000000000000030348", Category.WIDE_WINDOW.name())));
    }

    private void validateOrphanRefundCategory(List<ReconciledTransaction> reconList) {
        //check total
        assertEquals(1, reconList
                .stream()
                .filter(reconciledTransaction -> Category.ORPHAN_REFUND.name().equals(reconciledTransaction.category()))
                .count());

        //check that the right transaction matched
        assertTrue(reconList.contains(new ReconciledTransaction("TXN-000013", "ARN74000000000000052710", Category.ORPHAN_REFUND.name())));
    }

    private void validateUnmatchedInternalCategory(List<ReconciledTransaction> reconList) {
        //check total
        assertEquals(1, reconList
                .stream()
                .filter(reconciledTransaction -> Category.UNMATCHED_INTERNAL.name().equals(reconciledTransaction.category()))
                .count());

        //check that the right transaction matched
        assertTrue(reconList.contains(new ReconciledTransaction("TXN-000009", null, Category.UNMATCHED_INTERNAL.name())));
    }

    private void validateUnmatchedSettlementCategory(List<ReconciledTransaction> reconList) {
        //check total
        assertEquals(1, reconList
                .stream()
                .filter(reconciledTransaction -> Category.UNMATCHED_SETTLEMENT.name().equals(reconciledTransaction.category()))
                .count());

        //check that the right transaction matched
        assertTrue(reconList.contains(new ReconciledTransaction(null,"ARN74000000000000058801", Category.UNMATCHED_SETTLEMENT.name())));
    }

    private void validateCleanMatchCategory(List<ReconciledTransaction> reconList){
        //check total
        assertEquals(8, reconList
                .stream()
                .filter(reconciledTransaction -> Category.CLEAN_MATCH.name().equals(reconciledTransaction.category()))
                .count());

        //Check that the specific entries are correct
        List<ReconciledTransaction> cleanMatchTransactionList = new ArrayList<>();
        cleanMatchTransactionList.add(new ReconciledTransaction("TXN-000001", "ARN74000000000000008077", Category.CLEAN_MATCH.name()));
        cleanMatchTransactionList.add(new ReconciledTransaction("TXN-000002", "ARN74000000000000048583", Category.CLEAN_MATCH.name()));
        cleanMatchTransactionList.add(new ReconciledTransaction("TXN-000003", "ARN74000000000000005568", Category.CLEAN_MATCH.name()));
        cleanMatchTransactionList.add(new ReconciledTransaction("TXN-000004", "ARN74000000000000050652", Category.CLEAN_MATCH.name()));
        cleanMatchTransactionList.add(new ReconciledTransaction("TXN-000005", "ARN74000000000000055189", Category.CLEAN_MATCH.name()));
        cleanMatchTransactionList.add(new ReconciledTransaction("TXN-000006", "ARN74000000000000089290", Category.CLEAN_MATCH.name()));
        cleanMatchTransactionList.add(new ReconciledTransaction("TXN-000007", "ARN74000000000000058376", Category.CLEAN_MATCH.name()));
        cleanMatchTransactionList.add(new ReconciledTransaction("TXN-000008", "ARN74000000000000076360", Category.CLEAN_MATCH.name()));

        assertTrue(reconList.containsAll(cleanMatchTransactionList));
    }

    private void validateInProgressCategory(List<ReconciledTransaction> reconList) {
        //check total
        assertEquals(0, reconList
                .stream()
                .filter(reconciledTransaction -> Category.IN_PROGRESS.name().equals(reconciledTransaction.category()))
                .count());
    }

    private void validateNoNullCategory(List<ReconciledTransaction> reconList) {
        //check total
        assertEquals(0, reconList
                .stream()
                .filter(reconciledTransaction -> null == reconciledTransaction.category())
                .count());
    }
}
