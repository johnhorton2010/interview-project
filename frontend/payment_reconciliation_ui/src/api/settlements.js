// PUT /api/v1/processor-settlement-transactions — JSON array of settlements.
// The client validates structure client-side, then sends the parsed array
// UNMODIFIED (no coercion of settled_amount, no key renaming) per PRD §5.2.

import { apiPutJson } from './client.js';

/**
 * Parse settlement file text and validate its shape (PRD FR-2.2). Names the
 * offending array index on failure. Returns the parsed array unchanged.
 * @param {string} text
 * @returns {object[]}
 */
export function parseAndValidateSettlements(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('That file is not valid JSON.');
  }
  if (!Array.isArray(data)) {
    throw new Error('The settlement file must be a JSON array at its root.');
  }
  if (data.length === 0) {
    throw new Error('The settlement array is empty.');
  }
  data.forEach((el, i) => {
    if (el === null || typeof el !== 'object' || Array.isArray(el)) {
      throw new Error(`Element at index ${i} is not an object.`);
    }
    const ref = el.network_ref ?? el.networkRef;
    if (typeof ref !== 'string' || ref.trim() === '') {
      throw new Error(`Element at index ${i} is missing a non-empty "network_ref".`);
    }
  });
  return data;
}

export function validateSettlementFile(file) {
  if (!file) throw new Error('No file selected.');
  const name = (file.name || '').toLowerCase();
  if (!name.endsWith('.json') && file.type !== 'application/json') {
    throw new Error('Expected a .json file (the processor settlement export).');
  }
  if (file.size === 0) throw new Error('That file is empty.');
  if (file.size > 10 * 1024 * 1024) throw new Error('File is larger than 10 MB.');
}

/**
 * @param {object[]} settlements  the validated, unmodified parsed array
 * @returns {Promise<Record<string,'INSERTED_OR_UPDATED'|'NO_CHANGE'>>}
 */
export function uploadSettlements(settlements) {
  return apiPutJson('/processor-settlement-transactions', settlements);
}
