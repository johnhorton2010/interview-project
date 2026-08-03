/**
 * Reconciliation services that sit outside the categorization pipeline.
 *
 * <p>Two distinct things live here. The fee calculator is the arithmetic reference for the whole
 * application: it turns the published fee schedule into what a settlement should have been, and
 * owns the tolerance band that decides how close counts as matching. The reconciliation service is
 * the read side, serving finished verdicts for reporting and clearing them on request.
 *
 * <p>Neither runs reconciliation. The pipeline that produces verdicts lives in the nested
 * {@code engine} package, which depends on the fee calculator here for its arithmetic. Keeping the
 * read side separate from the engine means a reporting call cannot start a run.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.reconciliation.service;
