package com.platinumrelations.interview.payment_reconciliation.reconciliation.service;

import com.platinumrelations.interview.payment_reconciliation.core.config.FeeSchedule;
import com.platinumrelations.interview.payment_reconciliation.core.model.CardType;
import com.platinumrelations.interview.payment_reconciliation.core.model.Fee;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

@Service
public class FeeCalculator {

    FeeCalculator(FeeSchedule feeSchedule, @Value("${app.custom.tolerance.amount}") BigDecimal tolerance) {
        feesMap = feeSchedule.interchangeFeeMap();
        processorMarkup = feeSchedule.processorMarkup();
        this.tolerance = tolerance;
    }

    private final Map<CardType, Fee> feesMap;
    private final Fee processorMarkup;
    private final BigDecimal tolerance;

    //interchange_fee = round(gross × interchange.percent + interchange.flat)
    public BigDecimal computeInterchangeFee(CardType cardType, BigDecimal gross){
        Fee interchangeFee = feesMap.get(cardType);
        return ((gross.multiply(interchangeFee.percent())).add(interchangeFee.flat())).setScale(2, RoundingMode.HALF_UP);
    }

    //interchange_fee = round(gross × interchange.percent + interchange.flat)
    public BigDecimal computeInterchangeFee(String cardType, BigDecimal gross){
        return computeInterchangeFee(CardType.valueOf(cardType), gross);
    }

    //processor_fee   = round(gross × markup.percent      + markup.flat)
    public BigDecimal computeProcessorFee(BigDecimal gross){
        return ((gross.multiply(processorMarkup.percent())).add(processorMarkup.flat())).setScale(2, RoundingMode.HALF_UP);
    }

    //expected_settled = gross − interchange_fee − processor_fee
    public BigDecimal computeExpectedSettlement(BigDecimal gross, BigDecimal interchangeFee, BigDecimal processorFee){
        return gross.subtract(interchangeFee).subtract(processorFee);
    }

    //expected_settled = gross − interchange_fee − processor_fee
    public BigDecimal computeExpectedSettlement(CardType cardType, BigDecimal gross){
        return gross.subtract(computeInterchangeFee(cardType, gross)).subtract(computeProcessorFee(gross));
    }

    //expected_settled = gross − interchange_fee − processor_fee
    public BigDecimal computeExpectedSettlement(String cardType, BigDecimal gross){
        return computeExpectedSettlement(CardType.valueOf(cardType), gross);
    }

    // plus or minus a predetermined amount
    public boolean isWithinTolerance(BigDecimal providedAmount, BigDecimal targetAmount){
        BigDecimal settlementLowerbound = targetAmount.subtract(tolerance);
        BigDecimal settlementUpperbound = targetAmount.add(tolerance);

        return providedAmount.compareTo(settlementLowerbound) >= 0 && providedAmount.compareTo(settlementUpperbound) <= 0;
    }
}
