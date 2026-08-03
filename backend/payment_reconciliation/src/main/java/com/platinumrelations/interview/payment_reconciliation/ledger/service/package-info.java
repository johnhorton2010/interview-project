/**
 * Application logic for ingesting the merchant's ledger.
 *
 * <p>Sits between the REST layer and the repository: parses uploaded CSV into domain objects,
 * applies bean validation to each parsed row, and hands the whole set to the repository as one
 * batch. Reading the entire file before writing any of it means a malformed upload leaves no
 * partial load behind.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.ledger.service;
