/**
 * Payment reconciliation service: matches an internal ledger against processor settlement reports
 * and explains every difference between them.
 *
 * <p>The codebase is split into four top-level areas:
 * <ul>
 *   <li>{@code core} &mdash; shared value types, the fee schedule, and cross-cutting REST error
 *       handling; depends on nothing else in the application.</li>
 *   <li>{@code ledger} &mdash; ingestion and storage of the merchant's own transaction records.</li>
 *   <li>{@code processor} &mdash; ingestion and storage of the payment processor's settlement
 *       records.</li>
 *   <li>{@code reconciliation} &mdash; the pipeline that pairs the two sides and assigns each
 *       pairing a category.</li>
 * </ul>
 *
 * <p>Dependencies point inwards: {@code reconciliation} reads from {@code ledger} and
 * {@code processor}, and all three depend on {@code core}, never the reverse.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation;
