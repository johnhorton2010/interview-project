package com.platinumrelations.interview.payment_reconciliation.reconciliation.service;

import com.platinumrelations.interview.payment_reconciliation.core.config.FeeSchedule;
import com.platinumrelations.interview.payment_reconciliation.core.model.CardType;
import com.platinumrelations.interview.payment_reconciliation.core.model.Fee;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class FeeCalculatorTest {

    FeeCalculator feeCalculator;

    final static BigDecimal VISA_INTERCHANGE_PERCENT = new BigDecimal("0.018");
    final static BigDecimal VISA_INTERCHANGE_FLAT = new BigDecimal("0.10");

    final static BigDecimal PROCESSOR_MARKUP_PERCENT = new BigDecimal("0.003");
    final static BigDecimal PROCESSOR_MARKUP_FLAT = new BigDecimal("0.05");

    final static BigDecimal ONE_HUNDRED_DOLLARS = new BigDecimal("100.00");

    final static BigDecimal TOLERANCE_AMOUNT = new BigDecimal("0.01");

    @BeforeEach
    void setUp() {
        HashMap<CardType, Fee> interchangeFeeMap = new HashMap<>();
        interchangeFeeMap.put(CardType.VISA, new Fee(VISA_INTERCHANGE_PERCENT, VISA_INTERCHANGE_FLAT));

        FeeSchedule feeSchedule = Mockito.mock(FeeSchedule.class);
        when(feeSchedule.interchangeFeeMap()).thenReturn(interchangeFeeMap);
        when(feeSchedule.processorMarkup()).thenReturn(new Fee(PROCESSOR_MARKUP_PERCENT, PROCESSOR_MARKUP_FLAT));

        this.feeCalculator = new FeeCalculator(feeSchedule, TOLERANCE_AMOUNT);
    }

    @Test
    void computeInterchangeFee_calculatedFee_whenGivenCardTypeAndGross(){
        BigDecimal interchangeFee = feeCalculator.computeInterchangeFee(CardType.VISA, ONE_HUNDRED_DOLLARS);
        BigDecimal expectedFee = new BigDecimal("1.90");

        //interchange_fee = round(gross × interchange.percent + interchange.flat)
        assertEquals(0, expectedFee.compareTo(interchangeFee));
    }

    @Test
    void computeInterchangeFee_calculatedFee_whenGivenStringCardTypeAndGross(){
        BigDecimal interchangeFee = feeCalculator.computeInterchangeFee(CardType.VISA.name(), ONE_HUNDRED_DOLLARS);
        BigDecimal expectedFee = new BigDecimal("1.90");

        //interchange_fee = round(gross × interchange.percent + interchange.flat)
        assertEquals(0, expectedFee.compareTo(interchangeFee));
    }

    @Test
    void computeProcessFee_calculatedFee_whenGivenGross(){
        BigDecimal processorFee = feeCalculator.computeProcessorFee(ONE_HUNDRED_DOLLARS);
        BigDecimal expectedFee = new BigDecimal("0.35");

        //processor_fee   = round(gross × markup.percent      + markup.flat)
        assertEquals(0, expectedFee.compareTo(processorFee));
    }

    @Test
    void computeExpectedSettlement_calculatedFee_whenGivenGrossAndInterchangeFeeAndProcessorFee(){
        BigDecimal expectedInterchangeFee = new BigDecimal("1.90");
        BigDecimal expectedProcessorFee = new BigDecimal("0.35");
        BigDecimal expectedSettlement = ONE_HUNDRED_DOLLARS.subtract(expectedInterchangeFee).subtract(expectedProcessorFee);

        //expected_settled = gross − interchange_fee − processor_fee
        BigDecimal feeCalculatorExpectedSettlement = feeCalculator.computeExpectedSettlement(ONE_HUNDRED_DOLLARS, expectedInterchangeFee, expectedProcessorFee);

        assertEquals(0, feeCalculatorExpectedSettlement.compareTo(expectedSettlement));
    }

    @Test
    void computeExpectedSettlement_calculatedFee_whenGivenCardTypeAndGross(){
        BigDecimal expectedInterchangeFee = new BigDecimal("1.90");
        BigDecimal expectedProcessorFee = new BigDecimal("0.35");
        BigDecimal expectedSettlement = ONE_HUNDRED_DOLLARS.subtract(expectedInterchangeFee).subtract(expectedProcessorFee);

        //expected_settled = gross − interchange_fee − processor_fee
        BigDecimal feeCalculatorExpectedSettlement = feeCalculator.computeExpectedSettlement(CardType.VISA, ONE_HUNDRED_DOLLARS);

        assertEquals(0, feeCalculatorExpectedSettlement.compareTo(expectedSettlement));
    }

    @Test
    void computeExpectedSettlement_calculatedFee_whenGivenStringCardTypeAndGross(){
        BigDecimal expectedInterchangeFee = new BigDecimal("1.90");
        BigDecimal expectedProcessorFee = new BigDecimal("0.35");
        BigDecimal expectedSettlement = ONE_HUNDRED_DOLLARS.subtract(expectedInterchangeFee).subtract(expectedProcessorFee);

        //expected_settled = gross − interchange_fee − processor_fee
        BigDecimal feeCalculatorExpectedSettlement = feeCalculator.computeExpectedSettlement(CardType.VISA.name(), ONE_HUNDRED_DOLLARS);

        assertEquals(0, feeCalculatorExpectedSettlement.compareTo(expectedSettlement));
    }

    @Test
    void isWithinTolerance_true_whenAtLowerBound(){
        // isWithinTolerance = +- TOLERANCE_AMOUNT
        assertTrue(feeCalculator.isWithinTolerance(ONE_HUNDRED_DOLLARS.subtract(TOLERANCE_AMOUNT), ONE_HUNDRED_DOLLARS));
    }

    @Test
    void isWithinTolerance_true_whenAtUpperBound(){
        // isWithinTolerance = +- TOLERANCE_AMOUNT
        assertTrue(feeCalculator.isWithinTolerance(ONE_HUNDRED_DOLLARS.add(TOLERANCE_AMOUNT), ONE_HUNDRED_DOLLARS));
    }

    @Test
    void isWithinTolerance_true_whenWithinTolerance(){
        // isWithinTolerance = +- TOLERANCE_AMOUNT
        BigDecimal providedAmount = ONE_HUNDRED_DOLLARS.subtract(TOLERANCE_AMOUNT.multiply(new BigDecimal(".1")));
        assertTrue(feeCalculator.isWithinTolerance(providedAmount, ONE_HUNDRED_DOLLARS));
    }

    @Test
    void isWithinTolerance_true_whenExactlyAt(){
        // isWithinTolerance = +- TOLERANCE_AMOUNT
        assertTrue(feeCalculator.isWithinTolerance(ONE_HUNDRED_DOLLARS, ONE_HUNDRED_DOLLARS));
    }

    @Test
    void isWithinTolerance_false_whenOutOfToleranceUpper(){
        // isWithinTolerance = +- TOLERANCE_AMOUNT
        BigDecimal providedAmount = ONE_HUNDRED_DOLLARS.add(TOLERANCE_AMOUNT.multiply(new BigDecimal("10")));

        assertFalse(feeCalculator.isWithinTolerance(providedAmount, ONE_HUNDRED_DOLLARS));
    }

    @Test
    void isWithinTolerance_false_whenOutOfToleranceLower(){
        // isWithinTolerance = +- TOLERANCE_AMOUNT
        BigDecimal providedAmount = ONE_HUNDRED_DOLLARS.subtract(TOLERANCE_AMOUNT.multiply(new BigDecimal("10")));

        assertFalse(feeCalculator.isWithinTolerance(providedAmount, ONE_HUNDRED_DOLLARS));
    }

    @Test
    void isWithinTolerance_true_whenGivenNegativeAmount(){
        // isWithinTolerance = +- TOLERANCE_AMOUNT
        BigDecimal providedAmount = ONE_HUNDRED_DOLLARS.negate().subtract(TOLERANCE_AMOUNT.multiply(new BigDecimal("10")));

        assertFalse(feeCalculator.isWithinTolerance(providedAmount, ONE_HUNDRED_DOLLARS.negate()));
    }
}
