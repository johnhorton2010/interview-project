package com.platinumrelations.interview.payment_reconciliation.core.model;

import java.math.BigDecimal;

public record Fee (BigDecimal percent, BigDecimal flat) {}
