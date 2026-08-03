/**
 * Domain types for the merchant's internal ledger.
 *
 * <p>{@code InternalTransaction} is what the merchant believes happened; the {@code processor}
 * module holds what the processor reports actually happened, and reconciliation exists to explain
 * the difference.
 *
 * <p>Fields arriving from third-party CSV are typed as {@link java.lang.String} rather than as
 * enums so that an unrecognised value is loaded and quarantined rather than failing the upload.
 * Equality is narrowed to the transaction identifier alone, which is what lets the pipeline
 * collect transactions into sets without duplicates.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.ledger.model;
