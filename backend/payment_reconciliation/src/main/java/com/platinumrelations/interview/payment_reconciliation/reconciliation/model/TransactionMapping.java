package com.platinumrelations.interview.payment_reconciliation.reconciliation.model;

import com.platinumrelations.interview.payment_reconciliation.ledger.model.InternalTransaction;
import com.platinumrelations.interview.payment_reconciliation.processor.model.ProcessorSettlement;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.util.InternalTransactionKeyDeserializer;
import com.platinumrelations.interview.payment_reconciliation.reconciliation.util.ProcessorSettlementKeyDeserializer;
import tools.jackson.databind.annotation.JsonSerialize;

import java.util.Map;
import java.util.Set;

/**
 * The result of a matching query, indexed three ways for the categorizers that consume it.
 *
 * <p>All three views describe the same set of candidate pairings. They coexist because the
 * categorizers ask different questions and each would otherwise have to scan: one asks what a
 * given ledger transaction settled as, another asks what a given settlement belongs to, and a
 * third needs every row under one merchant reference at once to tell a split from a duplicate.
 * Building all three during the single pass over the result set is cheaper than re-querying.
 *
 * <p>Candidates, not conclusions: a transaction appearing here has been matched by the query's
 * criteria and nothing more. The fallback matching pass in particular can propose several ledger
 * rows for one settlement, and resolving that is the categorizers' job.
 *
 * <p>The record itself is shallowly immutable; the maps and sets it holds are not defensively
 * copied, so it is only as safe to share as the collections handed to it. In practice it is built
 * once by a result set extractor and read within a single pass.
 *
 * <p>Transactions are used directly as map keys, which relies on their equality being defined on
 * their identifiers alone. When serialised, those keys are reduced to identifier strings, since
 * JSON object keys must be scalars.
 *
 * @param internalTransactionToProcessorSettlementsMap  every settlement matched to each ledger
 *                                                      transaction; a set with more than one entry
 *                                                      indicates a split or duplicate settlement
 * @param processorSettlementToInternalTransactionsMap  the inverse view; a set with more than one
 *                                                      entry means the settlement could not be
 *                                                      resolved to a single ledger transaction,
 *                                                      which the fallback matching pass can produce
 * @param merchantRefToTransactionKeysMap               both sides grouped by merchant reference,
 *                                                      the view needed to judge splits, duplicates,
 *                                                      and sale-refund pairs
 * @author John
 */
public record TransactionMapping(
        @JsonSerialize(keyUsing = InternalTransactionKeyDeserializer.class)
        Map<InternalTransaction, Set<ProcessorSettlement>> internalTransactionToProcessorSettlementsMap,
        @JsonSerialize(keyUsing = ProcessorSettlementKeyDeserializer.class)
        Map<ProcessorSettlement, Set<InternalTransaction>> processorSettlementToInternalTransactionsMap,
        Map<String, TransactionPairing> merchantRefToTransactionKeysMap) {

}