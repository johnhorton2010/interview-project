/**
 * Application configuration read from external files at startup.
 *
 * <p>Holds the fee schedule, which defines what each transaction's settled amount should have
 * been and is therefore the reference every reconciliation comparison is made against. It is
 * parsed once during context refresh and published as immutable beans, so a malformed schedule
 * stops the application at startup rather than producing quietly wrong categories at runtime.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.core.config;
