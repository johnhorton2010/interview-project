/**
 * The reconciliation pipeline: decides what category every transaction and settlement belongs to.
 *
 * <p>{@code ReconciliationEngine} is the only public type here. Everything it drives is
 * package-private, so the pipeline can only be entered at the top and its internal ordering cannot
 * be bypassed from outside.
 *
 * <p>Three roles make up the package. The <em>engine</em> sequences the phases. <em>Coordinators</em>
 * own a shape of problem &mdash; one settlement per transaction, or several &mdash; and decide
 * which categorizers apply and in what precedence. <em>Categorizers</em> answer a single yes-or-no
 * question each, and deliberately do not know what happens to the answer.
 *
 * <p>Ordering is the main thing to understand, and it is not arbitrary. Unusable rows are
 * quarantined before anything can match them; matching claims pairings before anything judges
 * them; the categories decidable from set membership alone are settled before the ones needing
 * arithmetic; and multi-settlement groups are resolved before single settlements, because the
 * single-settlement coordinator treats any other shape as a pipeline error.
 *
 * <p>Where a decision needs only joins and counts it is expressed as SQL in the repository and the
 * categorizer here merely invokes it. Java is used only where the fee schedule or the business-day
 * calendar is required &mdash; that is, for amount mismatches, fee discrepancies, wide windows,
 * duplicates, and splits.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.reconciliation.service.engine;
