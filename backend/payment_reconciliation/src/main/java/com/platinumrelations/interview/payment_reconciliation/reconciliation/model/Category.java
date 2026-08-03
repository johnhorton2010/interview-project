package com.platinumrelations.interview.payment_reconciliation.reconciliation.model;

/**
 * The outcome assigned to a reconciled transaction &mdash; the vocabulary the whole pipeline
 * reports in.
 *
 * <p>Every pairing ends in exactly one category. {@link #IN_PROGRESS} is the only non-terminal
 * value: the matching passes write it to claim a pairing, and a later pass overwrites it with the
 * verdict. A pairing still carrying {@code IN_PROGRESS} after a run means no categorizer accepted
 * responsibility for it.
 *
 * <p>Several distinctions here are easy to conflate and are the substance of the reconciliation
 * problem:
 * <ul>
 *   <li>{@link #AMOUNT_MISMATCH} versus {@link #FEE_DISCREPANCY} &mdash; whether the settled
 *       amount is internally consistent with the fees the processor itself reported. If it is not,
 *       the principal is wrong; if it is, but those reported fees disagree with the published
 *       schedule, the fees are wrong. A check that only compares the settled amount against the
 *       reported fees passes in the second case.</li>
 *   <li>{@link #DUPLICATE} versus {@link #SPLIT} &mdash; whether multiple settlement rows each
 *       <em>repeat</em> the expected net, or together <em>sum</em> to it.</li>
 *   <li>{@link #ORPHAN_REFUND} versus a clean match &mdash; an orphan refund may settle perfectly
 *       against its own settlement row, so it is only detectable by the absence of an originating
 *       sale and must be found in a pass of its own.</li>
 * </ul>
 *
 * <p>Stored as a name rather than an ordinal, so constants may be reordered but not renamed
 * without migrating existing data.
 *
 * @author John
 */
public enum Category {
    /**
     * A pairing has been claimed by a matching pass but not yet judged. The only non-terminal
     * category; later passes filter on it to find work still to do.
     */
    IN_PROGRESS,
    /**
     * The row could not be reconciled because its own data is unusable &mdash; malformed or
     * missing values that make any comparison meaningless. Set before matching, so bad rows are
     * removed from consideration rather than producing spurious breaks downstream.
     */
    QUARANTINE,
    /**
     * Matched, but the settled principal is wrong: the settled amount cannot be explained even by
     * the fees the processor itself reported, beyond the rounding tolerance. The reported fees may
     * still agree with the schedule.
     */
    AMOUNT_MISMATCH,
    /**
     * Matched and internally consistent &mdash; the settled amount does equal gross minus the
     * reported fees &mdash; but those reported fees deviate from the published schedule. This is
     * the overcharge case, invisible to any check that does not consult the fee schedule.
     */
    FEE_DISCREPANCY,
    /**
     * The same payment settled more than once: multiple settlement rows each repeat the expected
     * net, so the merchant would be paid twice. Contrast {@link #SPLIT}, where the rows sum to the
     * net instead of repeating it.
     */
    DUPLICATE,
    /**
     * One capture settled as several partial rows that together sum to the expected net, with fees
     * apportioned across the parts. Legitimate, and distinguished from {@link #DUPLICATE} purely
     * by summing rather than repeating.
     */
    SPLIT,
    /**
     * A refund whose merchant reference matches no sale anywhere in the ledger &mdash; money
     * returned against an originating sale that does not exist. Detected by absence, in a pass
     * separate from settlement matching, because such a refund can otherwise settle cleanly and be
     * mistaken for a clean match.
     */
    ORPHAN_REFUND,
    /**
     * Matched and otherwise correct, but the settlement landed outside the expected business-day
     * window measured from capture. Reported rather than rejected: the money did arrive, so this
     * flags a timing anomaly, not a monetary break.
     */
    WIDE_WINDOW,
    /**
     * Present in the merchant's ledger but never settled &mdash; money owed to the merchant, or a
     * dropped payout.
     */
    UNMATCHED_INTERNAL,
    /**
     * Settled by the processor with no corresponding ledger record. Treated as a risk signal,
     * since it may indicate fraud or a booking the merchant never recorded.
     */
    UNMATCHED_SETTLEMENT,
    /**
     * Matched, settled for the expected amount within tolerance, with fees agreeing with the
     * schedule and timing inside the expected window. Nothing to act on.
     */
    CLEAN_MATCH
}
