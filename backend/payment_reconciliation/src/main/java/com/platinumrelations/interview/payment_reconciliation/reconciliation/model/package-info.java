/**
 * Domain types for reconciliation results and the intermediate structures used to reach them.
 *
 * <p>{@code Category} is the vocabulary the whole service reports in and is worth reading first;
 * the distinctions it draws &mdash; amount mismatch against fee discrepancy, duplicate against
 * split, orphan refund against clean match &mdash; are the substance of the problem, and the rest
 * of the pipeline exists to decide between them.
 *
 * <p>{@code ReconciledTransaction} is the only outcome that is persisted. The ledger and
 * settlement tables are never written to by the pipeline, so a run can always be repeated from
 * untouched inputs.
 *
 * <p>{@code TransactionMapping} and {@code TransactionPairing} are working structures rather than
 * results. They hold <em>candidate</em> matches, indexed several ways because the categorizers ask
 * different questions of the same data, and a candidate becomes a verdict only once a categorizer
 * accepts it.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.reconciliation.model;
