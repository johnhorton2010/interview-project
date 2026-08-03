/**
 * REST endpoints for the merchant's internal ledger.
 *
 * <p>Exposes bulk CSV upload and a full clear-down, both documented for OpenAPI. Endpoints
 * delegate immediately to the service layer and catch nothing; error translation is centralised in
 * {@code core.exception}.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.ledger.controller;
