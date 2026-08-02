import React, { useRef, useState } from 'react';
import { C, MONO, INK, INK2, POS, ACCENT, NEG } from '../styles/tokens.js';
import { Btn } from './common.jsx';
import { API_PREFIX } from '../api/client.js';

function DropCard({ title, accept, noun, outcomesNoun, busy, result, entriesOpen, onToggleEntries, onFile, hint, endpointHint }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  // The design shows the accepted file's name once an import lands.
  const [filename, setFilename] = useState(null);
  const imported = !!result;
  const state = busy ? 'uploading' : imported ? 'imported' : 'drop or click';
  const border = drag ? ACCENT : imported ? '#cfe6da' : '#cfd6e0';
  const bg = drag ? '#f5f8ff' : imported ? '#fbfdfc' : '#fbfcfd';

  const pick = (file) => {
    if (!file) return;
    setFilename(file.name);
    onFile(file);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          pick(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files[0]);
        }}
        style={{ width: '100%', textAlign: 'left', display: 'block', padding: 18, border: `1px dashed ${border}`, background: bg, borderRadius: 7, cursor: busy ? 'progress' : 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: INK }}>{title}</span>
          <span style={{ fontSize: 10, fontFamily: MONO, color: '#7b8697', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{state}</span>
        </div>
        <div style={{ fontSize: 12, color: '#7b8697', marginTop: 5, fontFamily: MONO }}>{busy ? endpointHint : imported ? filename || '✓ imported' : hint}</div>
      </button>

      {imported && !busy && (
        <div role="status" aria-live="polite" style={{ marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 7, background: C.surfaceAlt, animation: 'riseIn 160ms ease-out' }}>
          <div style={{ padding: '11px 13px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 13 }}>
              {result.total} {noun} accepted — {result.changed} new or updated, {result.unchanged} unchanged
            </span>
            <button type="button" onClick={onToggleEntries} style={{ border: 0, background: 'none', color: ACCENT, fontSize: 12, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}>
              {entriesOpen ? 'Hide outcomes' : `Per-${outcomesNoun} outcomes`}
            </button>
          </div>
          {entriesOpen && (
            <div style={{ borderTop: `1px solid ${C.borderSoft}`, maxHeight: 168, overflow: 'auto', padding: '6px 13px 10px' }}>
              {result.entries.map(([key, status]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: MONO, fontSize: 11, padding: '3px 0', borderBottom: `1px solid ${C.rowRule}` }}>
                  <span style={{ color: INK }}>{key}</span>
                  <span style={{ color: status === 'NO_CHANGE' ? '#7b8697' : POS }}>{status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ImportZone({ ledger, settle, run, reset, hasReport, importOpen, onCollapse, onExpand, collapsedSummary, error, onDismissError }) {
  if (hasReport && !importOpen) {
    return (
      <Btn onClick={onExpand} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, padding: '9px 28px', background: '#fff', border: 0, borderBottom: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 12, color: INK2 }} hoverStyle={{ background: C.surfaceAlt }}>
        <span style={{ fontFamily: MONO, color: INK }}>{collapsedSummary}</span>
        <span style={{ color: ACCENT }}>Open import</span>
      </Btn>
    );
  }

  return (
    <section style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, padding: '22px 28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: INK2 }}>Import</h2>
          <span style={{ fontSize: 12, color: '#7b8697' }}>Gracefully handles idempotent imports by checking for preexisting transactions.</span>
        </div>
        {hasReport && (
          <button type="button" onClick={onCollapse} style={{ border: 0, background: 'none', color: ACCENT, fontSize: 12, cursor: 'pointer', padding: 0 }}>Collapse</button>
        )}
      </div>

      {error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '9px 13px', background: '#fdecec', border: '1px solid #f2d2d2', borderRadius: 7, fontSize: 12.5, color: '#7a1f24' }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" onClick={onDismissError} aria-label="Dismiss" style={{ border: 0, background: 'none', color: NEG, fontSize: 15, cursor: 'pointer', padding: '0 2px' }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 260px', gap: 18, alignItems: 'start' }}>
        <DropCard title="Internal Ledger — CSV format" accept=".csv,text/csv" noun="transactions" outcomesNoun="transaction" busy={ledger.busy} result={ledger.result} entriesOpen={ledger.entriesOpen} onToggleEntries={ledger.onToggleEntries} onFile={ledger.onFile} hint=".csv" endpointHint={`PUT ${API_PREFIX}/ledger-transactions…`} />
        <DropCard title="Processor Settlements — JSON format" accept=".json,application/json" noun="settlements" outcomesNoun="settlement" busy={settle.busy} result={settle.result} entriesOpen={settle.entriesOpen} onToggleEntries={settle.onToggleEntries} onFile={settle.onFile} hint=".json" endpointHint={`PUT ${API_PREFIX}/processor-settlement-transactions…`} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 128 }}>
          <Btn onClick={run.onRun} disabled={run.disabled} style={{ border: `1px solid ${run.disabled ? C.border : ACCENT}`, background: run.disabled ? '#f8f9fb' : ACCENT, color: run.disabled ? '#aab3bf' : '#fff', padding: '11px 14px', fontSize: 13, fontWeight: 500, borderRadius: 6, cursor: run.disabled ? 'not-allowed' : 'pointer' }} hoverStyle={run.disabled ? null : { background: '#2a55bd' }}>
            {run.label}
          </Btn>
          {run.reconLine && <div role="status" aria-live="polite" style={{ fontSize: 12, color: POS, fontFamily: MONO }}>{run.reconLine}</div>}
          <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${C.borderSoft}` }}>
            <Btn onClick={reset.onOpen} disabled={reset.disabled} style={{ width: '100%', border: `1px solid ${reset.disabled ? '#eef1f4' : '#e8c6c7'}`, background: '#fff', color: reset.disabled ? '#aab3bf' : NEG, padding: '8px 12px', fontSize: 12, borderRadius: 6, cursor: reset.disabled ? 'not-allowed' : 'pointer' }} hoverStyle={reset.disabled ? null : { background: '#fdf5f5' }}>
              Reset data
            </Btn>
            <div style={{ fontSize: 11, color: '#9aa3b0', marginTop: 5, textWrap: 'pretty' }}>{reset.hint}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
