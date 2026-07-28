package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.core.model.RowStatus;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.ledger.model.Type;
import com.platinumrelations.interview.payment_reconciliation.ledger.repository.LedgerRepository;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.Category;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.ReconciledTransaction;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.model.TransactionMapping;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.repository.ReconciliationRepository;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.service.FeeCalculator;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
class InProgressCategorizer {

    InProgressCategorizer(LedgerRepository ledgerRepository, ReconciliationRepository reconciliationRepository, FeeCalculator feeCalculator){
        this.ledgerRepository = ledgerRepository;
        this.feeCalculator = feeCalculator;
        this.reconciliationRepository = reconciliationRepository;
    }

    private final LedgerRepository ledgerRepository;
    private final ReconciliationRepository reconciliationRepository;
    private final FeeCalculator feeCalculator;

    // Try to find the match for the missing merchant_ref in the processor settlement
    // Basing it on merchant id, card_last4, card_type, and then finally the transaction amounts within tolerance
    Map<ReconciledTransaction, RowStatus> matchingByBackupIdentifiers(){
        TransactionMapping transactionMapping = ledgerRepository.findByBackupIdentification();
        List<ReconciledTransaction> reconList = new ArrayList<>();

        for(Map.Entry<InternalTransaction, Set<ProcessorSettlement>> entry : transactionMapping.internalTransactionToProcessorSettlementsMap().entrySet()){
            InternalTransaction it = entry.getKey();

            for(ProcessorSettlement ps : entry.getValue()){
                // Is the settlement positive for a sale and negative for a refund?
                boolean isTransactionPairingPotentiallyValid =
                        (it.getType().equals(Type.SALE.name()) && ps.getSettledAmount().compareTo(BigDecimal.ZERO) >= 0) ||
                                (it.getType().equals(Type.REFUND.name()) && ps.getSettledAmount().compareTo(BigDecimal.ZERO) < 0);

                if(isTransactionPairingPotentiallyValid){
                    BigDecimal expectedSettlement = feeCalculator.computeExpectedSettlement(it.getCardType(), it.getGrossAmount());

                    if(feeCalculator.isWithinTolerance(ps.getSettledAmount(), expectedSettlement)){
                        reconList.add(new ReconciledTransaction(it.getInternalTxnId(), ps.getNetworkRef(), Category.IN_PROGRESS.name()));
                    }
                }
            }
        }

        return reconciliationRepository.saveAll(reconList);
    }

    int matchingByMerchantRef(){
        return reconciliationRepository.createReconciledTransactionWithMatchBasedExactMerchantRef();
    }
}
