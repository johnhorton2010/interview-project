/**
 * Data access for the {@code processor_settlement} table.
 *
 * <p>Follows the same policy as the ledger repository: hand-written SQL over Spring's JDBC
 * clients, insert-only merges so a re-sent report cannot overwrite an already-reconciled
 * settlement, and no transaction boundary of its own.
 *
 * <p>Also exposes the query for settlements that arrived with no usable merchant reference, which
 * is what forces the pipeline's fallback matching pass to exist.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.processor.repository;
