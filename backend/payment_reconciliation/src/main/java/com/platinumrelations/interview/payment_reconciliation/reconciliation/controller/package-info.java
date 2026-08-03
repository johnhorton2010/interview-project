/**
 * REST endpoints for running reconciliation and reading its results.
 *
 * <p>Three operations: start a run, fetch the finished verdicts, and discard them. Running and
 * reporting are separate calls by design, so fetching a report can never trigger a run.
 *
 * <p>Nothing here ingests data. Both the ledger and the settlement feed are loaded through their
 * own modules' endpoints, and reconciliation reads whatever is present at the time it runs.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.reconciliation.controller;
