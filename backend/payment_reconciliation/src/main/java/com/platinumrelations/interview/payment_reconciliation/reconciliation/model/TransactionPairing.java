package com.platinumrelations.interview.payment_reconciliation.reconciliation.model;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.util.InternalTransactionSetToKeySerializer;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.util.ProcessorSettlementSetToKeySerializer;
import lombok.Data;
import tools.jackson.databind.annotation.JsonSerialize;

import java.util.HashSet;
import java.util.Set;

/**
 * Both sides of a candidate match, grouped under a single merchant reference.
 *
 * <p>Each side is a set rather than a single value because a merchant reference legitimately
 * covers more than one row on either side: a refunded order contributes both a sale and a refund
 * to the ledger, and one capture may settle as several rows that are either a
 * {@link Category#SPLIT} or a {@link Category#DUPLICATE}. Deciding which of those it is requires
 * seeing every row under the reference at once, which is what this type provides.
 *
 * <p>Both sets are initialised empty and are never {@code null}, so callers can add to them
 * without a null check. Set membership follows each element's identifier-only equality, so a row
 * reached through several different joins is stored once.
 *
 * <p>Mutable, with Lombok-generated accessors. Instances are built up during a single
 * reconciliation pass and are not safe to share across threads.
 *
 * <p>When serialised, each side is reduced to its identifiers rather than the full objects; a
 * response would otherwise repeat every transaction body once per reference it appears under.
 *
 * @author John
 */
@Data
public class TransactionPairing {
    /** Ledger rows sharing this merchant reference; typically a sale, plus its refund if one exists. */
    @JsonSerialize(using = InternalTransactionSetToKeySerializer.class)
    private Set<InternalTransaction> internalTransactions = new HashSet<>();
    /** Settlement rows sharing this merchant reference; more than one indicates a split or a duplicate. */
    @JsonSerialize(using = ProcessorSettlementSetToKeySerializer.class)
    private Set<ProcessorSettlement> processorSettlements = new HashSet<>();
}
