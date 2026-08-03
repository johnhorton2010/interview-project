package com.platinumrelations.interview.payment_reconciliation.core.model;

/**
 * Outcome of an upsert for a single row of a bulk import.
 *
 * <p>Derived from the affected-row count each {@code MERGE} in a JDBC batch reports, so bulk
 * endpoints are idempotent: re-uploading the same file yields {@link #NO_CHANGE} for every row
 * rather than an error, letting the caller distinguish "already loaded" from "just loaded"
 * without re-reading the data.
 *
 * @author John
 */
public enum RowStatus {
    /** The merge affected at least one row &mdash; the record was inserted or an existing record was updated. */
    INSERTED_OR_UPDATED,
    /** The merge affected no rows, so the stored record already matched and the database was left untouched. */
    NO_CHANGE
}
