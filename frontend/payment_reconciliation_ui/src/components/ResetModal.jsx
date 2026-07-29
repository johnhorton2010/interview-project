import React, { useRef, useEffect } from 'react';
import { RESET_STEPS } from '../api/reset.js';
import { C, MONO, INK, INK2, NEG, POS, ACCENT } from '../styles/tokens.js';

export default function ResetModal({ open, phase, phrase, setPhrase, done, failedAt, onConfirm, onClose }) {
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
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== 'running') onClose();
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(19,26,36,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div style={{ width: 460, maxWidth: '100%', background: '#fff', borderRadius: 10, boxShadow: '0 24px 60px rgba(19,26,36,0.3)', padding: 22, animation: 'riseIn 140ms ease-out' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: INK }}>{title}</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: INK2, textWrap: 'pretty' }}>{body}</p>

        {(phase === 'running' || phase === 'failed' || phase === 'done') && (
          <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
            {stepView.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6, background: s.bg }}>
                <span style={{ color: s.markColor, fontWeight: 600 }}>{s.mark}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: INK, flex: 1 }}>{s.endpoint}</span>
                <span style={{ fontSize: 11, color: s.statusColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.status}</span>
              </div>
            ))}
          </div>
        )}

        {phase === 'confirm' && (
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: INK2 }}>
              Type <strong style={{ fontFamily: MONO }}>RESET</strong> to confirm
            </span>
            <input ref={inputRef} value={phrase} onChange={(e) => setPhrase(e.target.value)} style={{ width: '100%', marginTop: 6, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: MONO }} />
          </label>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} disabled={phase === 'running'} style={{ border: `1px solid ${C.border}`, background: '#fff', color: INK2, padding: '8px 14px', fontSize: 13, borderRadius: 6, cursor: phase === 'running' ? 'not-allowed' : 'pointer' }}>
            {cancelLabel}
          </button>
          {phase !== 'done' && (
            <button type="button" onClick={onConfirm} disabled={confirmDisabled || phase === 'running'} style={{ border: `1px solid ${confirmDisabled || phase === 'running' ? '#eef1f4' : NEG}`, background: confirmDisabled || phase === 'running' ? '#f8f9fb' : NEG, color: confirmDisabled || phase === 'running' ? '#aab3bf' : '#fff', padding: '8px 14px', fontSize: 13, borderRadius: 6, cursor: confirmDisabled || phase === 'running' ? 'not-allowed' : 'pointer' }}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
