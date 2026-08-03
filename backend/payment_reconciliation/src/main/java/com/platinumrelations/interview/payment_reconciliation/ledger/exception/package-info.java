/**
 * Failures specific to ledger ingestion.
 *
 * <p>Holds only the exception types; their translation to HTTP responses lives in
 * {@code core.exception}. All are unchecked, so they travel from the parser to the advice without
 * intermediate layers having to declare or rewrap them.
 *
 * <p>The distinction these types draw is file-level versus cell-level: a problem with the file as
 * a whole is raised here and aborts the upload, whereas a single malformed value is absorbed
 * during deserialization so the row still loads and can be quarantined by the reconciliation
 * pipeline.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.ledger.exception;
