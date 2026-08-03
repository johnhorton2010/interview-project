/**
 * Mapping helpers that sit between reconciliation's data and its wire and query formats.
 *
 * <p>Two concerns live here, both consequences of transactions and settlements being used directly
 * as map keys and set members rather than being copied into purpose-built DTOs.
 *
 * <p>On the query side, a result set extractor collapses a flat join &mdash; where ledger columns
 * repeat once per matched settlement &mdash; into the several indexed views the categorizers need,
 * rebuilding each distinct row exactly once so every view shares the same instances.
 *
 * <p>On the wire side, a family of serializers reduces transactions and settlements to their
 * identifiers. In key position this is unavoidable, since JSON object keys must be scalars; in
 * value position it is a size decision, because one transaction can appear in several views of a
 * single response.
 *
 * <p>Two of these classes are named {@code KeyDeserializer} but are in fact serializers. The names
 * are load-bearing, being referenced by annotation from the model types.
 *
 * @author John
 */
package com.platinumrelations.interview.payment_reconciliation.reconciliation.util;
