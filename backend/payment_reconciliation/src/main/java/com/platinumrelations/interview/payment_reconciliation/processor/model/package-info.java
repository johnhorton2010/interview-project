/**
 * Domain types for the payment processor's settlement feed.
 *
 * <p>{@code ProcessorSettlement} is what the processor says actually happened, against the
 * {@code ledger} module's record of what the merchant believes happened.
 *
 * <p>The reported amounts and fees are treated as claims rather than facts: reconciliation
 * recomputes them from the fee schedule and classifies each transaction by how the reported and
 * expected figures diverge. Signs are meaningful &mdash; a settlement is positive for a sale and
 * negative for a refund &mdash; which is how matching prevents a sale pairing with a refund.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.processor.model;
