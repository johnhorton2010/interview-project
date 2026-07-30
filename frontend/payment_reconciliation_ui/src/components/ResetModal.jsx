import React, { useRef, useEffect } from 'react';
import { RESET_STEPS } from '../api/reset.js';
import { C, MONO, INK, INK2, NEG, POS, ACCENT } from '../styles/tokens.js';

export default function ResetModal({ open, phase, phrase, setPhrase, done, failedAt, error, onConfirm, onClose }) {
  const inputRef = useRef(null);
  useEffect(() => {
    if (open && phase === 'confirm') setTimeout(() => inputRef.current?.focus(), 40);
  }, [open, phase]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && phase !== 'running') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, phase, onClose]);

  if (!open) return null;

  const title =
    phase === 'done' ? 'All ingested data deleted' : phase === 'running' ? 'Deleting ingested data' : phase === 'failed' ? 'Reset did not complete' : 'Delete all ingested data';
  const body =
    phase === 'done'
      ? 'Reconciliations and both source datasets were cleared. Import the ledger and settlement files to start again.'
      : phase === 'running'
        ? 'Clearing reconciliations, then the internal ledger, then processor settlements. Do not close this window.'
        : phase === 'failed'
          ? 'The sequence halted partway. Read the status of each dataset below before retrying or importing anything.'
          : 'This clears reconciliations, then the internal ledger, then processor settlements — on the server. It is irreversible and there is no undo. You will need to re-import both files.';
  const confirmDisabled = phase === 'confirm' && phrase.trim().toUpperCase() !== 'RESET';
  const confirmLabel = phase === 'running' ? 'Deleting…' : phase === 'failed' ? 'Retry' : 'Delete everything';
  const cancelLabel = phase === 'done' ? 'Done' : phase === 'running' ? 'Close' : phase === 'failed' ? 'Dismiss' : 'Cancel';

  const failedStep = RESET_STEPS.find((st) => st.key === failedAt);
  const errStatus = error && error.status;
  const errBody = error && (typeof error.body === 'string' && error.body ? error.body : error.message);
  const errorBody =
    (failedStep ? failedStep.endpoint : 'A delete step') +
    (errStatus ? ` returned ${errStatus}` : ' could not be reached') +
    (errBody ? ` — ${String(errBody).slice(0, 160)}` : '') +
    '. Earlier steps that succeeded are shown above; nothing after the failure was attempted.';

  const stepView = RESET_STEPS.map((st, i) => {
    const isDone = done.includes(st.key);
    const isFailed = failedAt === st.key;
    const active = phase === 'running' && !isDone && !isFailed && done.length === i;
    const halted = phase === 'failed' && !isDone && !isFailed;
    return {
      endpoint: st.endpoint,
      mark: isDone ? '✓' : isFailed ? '✕' : '·',
      markColor: isDone ? POS : isFailed ? NEG : '#cfd6e0',
      status: isDone ? 'cleared' : isFailed ? 'failed' : active ? 'deleting' : halted ? 'not attempted' : 'pending',
      statusColor: isDone ? POS : isFailed ? NEG : active ? ACCENT : '#9aa3b0',
      bg: isFailed ? '#fdf5f5' : isDone ? '#fbfdfc' : '#fff',
    };
  });

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== 'running') onClose();
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(19,26,36,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      {/* The dialog role belongs on the box, not the backdrop, and it needs a name. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-dialog-title"
        style={{ width: 480, maxWidth: '100%', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 9, boxShadow: '0 24px 60px rgba(19,26,36,0.22)', animation: 'riseIn 160ms ease-out' }}
      >
        <div style={{ padding: '18px 20px 0' }}>
          <h2 id="reset-dialog-title" style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: INK }}>{title}</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: INK2, textWrap: 'pretty' }}>{body}</p>
        </div>

        <div style={{ margin: '16px 20px', border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden' }}>
          {stepView.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: `1px solid ${C.rowRule}`, background: s.bg }}>
              <span aria-hidden="true" style={{ fontFamily: MONO, fontSize: 12, color: s.markColor }}>{s.mark}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: INK2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.endpoint}</span>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: s.statusColor }}>{s.status}</span>
            </div>
          ))}
        </div>

        {phase === 'failed' && (
          <div role="status" style={{ margin: '0 20px 16px', border: '1px solid #f2d2d2', background: '#fcecec', borderRadius: 7, padding: '11px 13px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#b02a30' }}>Reset did not complete</div>
            <p style={{ margin: '5px 0 0', fontSize: 12, color: '#7a3034', textWrap: 'pretty' }}>{errorBody}</p>
          </div>
        )}

        {phase === 'confirm' && (
          <div style={{ padding: '0 20px 4px' }}>
            <label style={{ display: 'block', fontSize: 12, color: INK2 }}>
              Type <span style={{ fontFamily: MONO, fontWeight: 600, color: INK }}>RESET</span> to confirm
            </label>
            <input
              ref={inputRef}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="RESET"
              aria-label="Type RESET to confirm"
              style={{ width: '100%', marginTop: 6, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: MONO, fontSize: 13, letterSpacing: '0.04em', color: INK }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px 18px' }}>
          <button type="button" onClick={onClose} disabled={phase === 'running'} style={{ border: `1px solid ${C.border}`, background: '#fff', color: INK2, padding: '8px 14px', fontSize: 12, borderRadius: 6, cursor: phase === 'running' ? 'not-allowed' : 'pointer' }}>
            {cancelLabel}
          </button>
          {(phase === 'confirm' || phase === 'failed') && (
            <button type="button" onClick={onConfirm} disabled={confirmDisabled} style={{ border: `1px solid ${confirmDisabled ? '#eef1f4' : NEG}`, background: confirmDisabled ? '#f8f9fb' : NEG, color: confirmDisabled ? '#aab3bf' : '#fff', padding: '8px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, cursor: confirmDisabled ? 'not-allowed' : 'pointer' }}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
