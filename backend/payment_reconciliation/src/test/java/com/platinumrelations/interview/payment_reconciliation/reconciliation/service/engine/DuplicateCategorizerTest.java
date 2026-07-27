package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;

import com.platinumrelations.interview.payment_reconciliation.core.model.CardType;
import com.platinumrelations.interview.payment_reconciliation.core.model.Currency;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

@ExtendWith(MockitoExtension.class)
public class DuplicateCategorizerTest {

    @InjectMocks
    private DuplicateCategorizer duplicateCategorizer;

    @Test
    void findDuplicateProcessorSettlements_matchesAsDuplicate_withDuplicate(){
        ProcessorSettlement ps1 = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .cardLast4("1256")
                .cardType(CardType.VISA.name())
                .currency(Currency.USD.name())
                .interchangeFee(new BigDecimal("5.00"))
                .merchantId("1550")
                .merchantRef("ref1234")
                .processorFee(new BigDecimal("0.50"))
                .settledAmount(new BigDecimal("44.43"))
                .settlementDate(LocalDate.of(01,01,01))
                .build();
        ProcessorSettlement ps2 = ProcessorSettlement
                .builder()
                .networkRef("ps2")
                .cardLast4("1256")
                .cardType(CardType.VISA.name())
                .currency(Currency.USD.name())
                .interchangeFee(new BigDecimal("5.00"))
                .merchantId("1550")
                .merchantRef("ref1234")
                .processorFee(new BigDecimal("0.50"))
                .settledAmount(new BigDecimal("44.43"))
                .settlementDate(LocalDate.of(01,01,01))
                .build();

        Set<ProcessorSettlement> result = duplicateCategorizer.findDuplicateProcessorSettlements(Set.of(ps1, ps2));

        assertEquals(2, result.size());
    }

    @Test
    void findDuplicateProcessorSettlements_noneAsDuplicate_withUniqueCardLast4(){
        ProcessorSettlement ps1 = ProcessorSettlement
                .builder()
                .networkRef("ps1")
                .cardLast4("1256")
                .cardType(CardType.VISA.name())
                .currency(Currency.USD.name())
                .interchangeFee(new BigDecimal("5.00"))
                .merchantId("1550")
                .merchantRef("ref1234")
                .processorFee(new BigDecimal("0.50"))
                .settledAmount(new BigDecimal("44.43"))
                .settlementDate(LocalDate.of(01,01,01))
                .build();
        ProcessorSettlement ps2 = ProcessorSettlement
                .builder()
                .networkRef("ps2")
                .cardLast4("9999")
                .cardType(CardType.VISA.name())
                .currency(Currency.USD.name())
                .interchangeFee(new BigDecimal("5.00"))
                .merchantId("1550")
                .merchantRef("ref1234")
                .processorFee(new BigDecimal("0.50"))
                .settledAmount(new BigDecimal("44.43"))
                .settlementDate(LocalDate.of(01,01,01))
                .build();

        Set<ProcessorSettlement> result = duplicateCategorizer.findDuplicateProcessorSettlements(Set.of(ps1, ps2));

        assertEquals(0, result.size());
    }
}
