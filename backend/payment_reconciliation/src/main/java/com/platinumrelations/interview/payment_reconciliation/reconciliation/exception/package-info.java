/**
 * Failures specific to reconciliation, and the startup diagnostics for them.
 *
 * <p>Two kinds live here, distinguished by when they occur. Configuration failures &mdash; an
 * unreadable fee schedule, an unparseable holiday date &mdash; happen during context refresh and
 * deliberately prevent the application from starting, because both inputs define what a correct
 * settlement looks like and running without them would mis-classify silently rather than fail
 * visibly. Each is paired with an {@code AbstractFailureAnalyzer} that replaces the stack trace
 * with a description and a suggested fix; the analyzer is selected by its exception type
 * parameter, so that type must match the failure it explains.
 *
 * <p>The remaining failure is a pipeline invariant violation raised during a run, which travels
 * through the REST error handler in {@code core.exception} instead.
 *
 * <p>Analyzers are registered through {@code spring.factories}, not as beans, since they must
 * exist before the context they diagnose has finished refreshing.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.reconciliation.exception;
