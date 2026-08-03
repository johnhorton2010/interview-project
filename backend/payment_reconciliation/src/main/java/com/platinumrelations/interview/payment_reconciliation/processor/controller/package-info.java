/**
 * REST endpoints for the processor settlement feed.
 *
 * <p>Exposes bulk JSON load and a full clear-down, both documented for OpenAPI. Unlike the ledger
 * endpoints the payload is a structured array rather than a file, so bean validation applies
 * directly at the request boundary and a malformed element rejects the request before anything is
 * stored.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.processor.controller;
