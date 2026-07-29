// PUT /api/v1/ledger-transactions — multipart upload of the internal ledger CSV.
// The raw file is sent as selected; the client does not parse or re-serialise it.

import { apiPutForm } from './client.js';

/** Client-side guards before upload (PRD FR-1.2). Throws on failure. */
export function validateLedgerFile(file) {
  if (!file) throw new Error('No file selected.');
  const name = (file.name || '').toLowerCase();
  if (!name.endsWith('.csv') && file.type !== 'text/csv') {
    throw new Error('Expected a .csv file (the internal ledger export).');
  }
  if (file.size === 0) throw new Error('That file is empty.');
  if (file.size > 10 * 1024 * 1024) throw new Error('File is larger than 10 MB.');
}

/**
 * @param {File} file
 * @returns {Promise<Record<string,'INSERTED_OR_UPDATED'|'NO_CHANGE'>>}
 */
export function uploadLedger(file) {
  validateLedgerFile(file);
  const form = new FormData();
  form.append('file', file, file.name);
  return apiPutForm('/ledger-transactions', form);
}
