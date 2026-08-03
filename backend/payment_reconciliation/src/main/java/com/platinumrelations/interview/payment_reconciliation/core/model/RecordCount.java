package com.platinumrelations.interview.payment_reconciliation.core.model;

import lombok.Builder;

/**
 * Response body wrapping a single count of affected records.
 *
 * <p>Exists so that endpoints such as the bulk deletes return a named JSON object
 * ({@code {"record_count": 23}}) instead of a bare integer, which keeps the response
 * extensible without a breaking change.
 *
 * @param recordCount the number of records affected; zero when the operation matched nothing,
 *                    never negative
 * @author John
 */
@Builder
public record RecordCount (
    int recordCount) {

}
