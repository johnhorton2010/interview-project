/**
 * Application logic for ingesting the processor settlement feed.
 *
 * <p>Thinner than its ledger counterpart because settlements arrive already structured as JSON and
 * need no parsing step. The layer is kept regardless, so the transaction and business-rule seam
 * stays out of the controller and the two ingest paths remain symmetrical.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.processor.service;
