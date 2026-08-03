/**
 * Data access for the {@code ledger} table.
 *
 * <p>Hand-written SQL over Spring's JDBC clients rather than an ORM: the queries here are
 * set-oriented joins and merges whose exact shape carries the matching rules, which an ORM would
 * obscure.
 *
 * <p>Writes are insert-only merges, so loading a file can never overwrite a transaction that has
 * already been reconciled. Reads come in two kinds &mdash; plain retrieval, and the candidate-pairing
 * query used when a settlement arrives with no merchant reference to join on.
 *
 * <p>No method here opens a transaction; the boundary belongs to the caller.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.ledger.repository;
