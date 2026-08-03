/**
 * Data access for {@code reconciled_transactions}, the table holding every reconciliation verdict.
 *
 * <p>The busiest repository in the application, because much of the reconciliation logic lives in
 * SQL rather than in Java. The dividing line is deliberate: any case decidable by joins, counts,
 * and set membership &mdash; a ledger row that matched nothing, a refund whose reference appears
 * only once &mdash; is settled by a statement here, since the database can answer it over the
 * whole data set at once. Only decisions needing the fee schedule or the business-day calendar are
 * pulled into the engine.
 *
 * <p>Verdicts are reached in two steps. A matching pass claims a pairing as {@code IN_PROGRESS},
 * and a later pass replaces that with a terminal category. Categorizing statements restrict
 * themselves to rows still {@code IN_PROGRESS}, so no pass can overwrite a verdict another pass
 * already reached, and a whole run can be repeated without compounding its own output.
 *
 * <p>This package writes only to its own table. The ledger and settlement tables are read but
 * never modified, so clearing the verdicts restores the system exactly to its pre-run state.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.reconciliation.repository;
