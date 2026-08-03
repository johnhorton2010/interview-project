/**
 * Cross-cutting REST error handling.
 *
 * <p>Defines the single error payload every endpoint returns on failure and the
 * {@code @RestControllerAdvice} that maps exceptions onto it. Module-specific exception
 * <em>types</em> are declared next to the code that throws them, in
 * {@code ledger.exception} and {@code reconciliation.exception}; only the HTTP translation is
 * centralised here, so a new failure mode needs one handler method rather than a change in every
 * controller.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.core.exception;
