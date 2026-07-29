import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getReconciliations, runReconciliation } from './api/reconciliations.js';
import { validateLedgerFile, uploadLedger } from './api/ledger.js';
import { validateSettlementFile, parseAndValidateSettlements, uploadSettlements } from './api/settlements.js';
import { summarizeStatuses } from './api/client.js';
import { runReset } from './api/reset.js';
import { normalize } from './domain/normalize.js';
import { C, MONO, INK, INK2, ACCENT } from './styles/tokens.js';
import { Toast, Btn } from './components/common.jsx';
import ImportZone from './components/ImportZone.jsx';
import ResetModal from './components/ResetModal.jsx';
import Report from './components/report/Report.jsx';

const STALE_KEY = 'recon.stale';

function Header({ onRefresh }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '0 28px', height: 56, background: '#fff', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>Settlement Reconciliation</span>
        <span style={{ fontSize: 11, color: '#7b8697', fontFamily: MONO }}>v1 · all imported data</span>
      </div>
      <Btn onClick={onRefresh} style={{ border: `1px solid ${C.border}`, background: '#fff', color: INK2, padding: '5px 11px', fontSize: 12, borderRadius: 5, cursor: 'pointer' }} hoverStyle={{ borderColor: '#c9d1dc', color: INK }}>
        Refresh
      </Btn>
    </header>
  );
}

function EmptyState() {
  const steps = [
    ['01', 'Import the internal ledger CSV.', 'The file is sent as selected — nothing is parsed or reordered in the browser.'],
    ['02', 'Import the processor settlement JSON.', 'Validated as a non-empty array of objects with a network ref, then passed through unmodified.'],
    ['03', 'Run reconciliation.', "Matching, tolerance and categories are the backend's work. This screen reads the result."],
  ];
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '72px 28px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>No reconciliation yet</h1>
      <p style={{ margin: '0 0 32px', color: INK2, maxWidth: '52ch', textWrap: 'pretty' }}>Three steps to a report you can defend line by line.</p>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
        {steps.map(([n, title, body]) => (
          <li key={n} style={{ background: '#fff', padding: '18px 20px', display: 'grid', gridTemplateColumns: '26px 1fr', gap: 14 }}>
            <span style={{ fontFamily: MONO, color: '#9aa3b0', fontSize: 12 }}>{n}</span>
            <span>
              <strong style={{ fontWeight: 500 }}>{title}</strong>
              <br />
              <span style={{ color: INK2 }}>{body}</span>
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}

export default function App() {
  const [data, setData] = useState({ status: 'loading', model: null, error: null });
  const [busy, setBusy] = useState(null);
  const [ledgerRes, setLedgerRes] = useState(null);
  const [settleRes, setSettleRes] = useState(null);
  const [ledgerEntriesOpen, setLedgerEntriesOpen] = useState(false);
  const [settleEntriesOpen, setSettleEntriesOpen] = useState(false);
  const [reconCount, setReconCount] = useState(null);
  const [importErr, setImportErr] = useState(null);
  const [importOpen, setImportOpen] = useState(null); // null → derive from hasReport
  const [stale, setStale] = useState(() => sessionStorage.getItem(STALE_KEY) === '1');
  const [tab, setTab] = useState('categories');
  const [expanded, setExpanded] = useState(null);
  const [toast, setToast] = useState(null);
  const [br, setBr] = useState({ query: '', catFilter: [], merchantFilter: null, sortKey: 'impact', sortDir: 'desc', catOpen: false, helpOpen: false });
  const [tx, setTx] = useState({ query: '', cats: [], type: 'all', view: 'ledger', sortKey: 'disc', sortDir: 'desc', catOpen: false });
  const [reset, setReset] = useState({ open: false, phase: 'confirm', phrase: '', done: [], failedAt: null });

  const toastTimer = useRef(null);
  const flash = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const markStale = useCallback((v) => {
    setStale(v);
    sessionStorage.setItem(STALE_KEY, v ? '1' : '0');
  }, []);

  const reload = useCallback(async () => {
    try {
      const payload = await getReconciliations();
      const model = normalize(payload);
      setData({ status: model.rows.length ? 'ready' : 'empty', model, error: null });
    } catch (e) {
      setData({ status: 'error', model: null, error: e });
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const hasReport = data.status === 'ready';
  const effImportOpen = importOpen === null ? !hasReport : importOpen;

  const scrollTabs = () =>
    setTimeout(() => document.getElementById('report-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);

  const nav = {
    goTab: (t) => {
      setTab(t);
      scrollTabs();
    },
    toBreaks: (patch = {}) => {
      const { expanded: exp, ...rest } = patch;
      setBr((b) => ({ ...b, query: '', catFilter: [], merchantFilter: null, sortKey: 'impact', sortDir: 'desc', ...rest }));
      setExpanded(exp ?? null);
      setTab('breaks');
      scrollTabs();
    },
    toTransactions: (patch = {}) => {
      setTx((t) => ({ ...t, query: '', cats: [], type: 'all', view: 'ledger', sortKey: 'disc', sortDir: 'desc', ...patch }));
      setExpanded(null);
      setTab('transactions');
      scrollTabs();
    },
    toQuarantine: () => {
      setTab('quarantine');
      scrollTabs();
    },
  };

  const handleLedgerFile = async (file) => {
    setImportErr(null);
    try {
      validateLedgerFile(file);
    } catch (e) {
      setImportErr(e.message);
      return;
    }
    setBusy('ledger');
    try {
      const map = await uploadLedger(file);
      setLedgerRes(summarizeStatuses(map));
      if (hasReport) markStale(true);
    } catch (e) {
      setImportErr(`Ledger import failed${e.status ? ` (${e.status})` : ''}. ${e.body || e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleSettleFile = async (file) => {
    setImportErr(null);
    try {
      validateSettlementFile(file);
    } catch (e) {
      setImportErr(e.message);
      return;
    }
    let text;
    try {
      text = await file.text();
    } catch {
      setImportErr('Could not read the selected file.');
      return;
    }
    let arr;
    try {
      arr = parseAndValidateSettlements(text);
    } catch (e) {
      setImportErr(e.message);
      return;
    }
    setBusy('settle');
    try {
      const map = await uploadSettlements(arr);
      setSettleRes(summarizeStatuses(map));
      if (hasReport) markStale(true);
    } catch (e) {
      setImportErr(`Settlement import failed${e.status ? ` (${e.status})` : ''}. ${e.body || e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const onRun = async () => {
    if (busy) return;
    setBusy('run');
    try {
      const count = await runReconciliation();
      setReconCount(typeof count === 'number' ? count : parseInt(count, 10) || 0);
      await reload();
      markStale(false);
      setImportOpen(false);
      setTab('categories');
      setExpanded(null);
      flash(`${count} reconciled records created`);
    } catch (e) {
      setImportErr(`Reconciliation failed${e.status ? ` (${e.status})` : ''}. ${e.body || e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const onRefresh = async () => {
    await reload();
    flash('Refreshed — GET /api/v1/reconciliations');
  };

  const confirmReset = async () => {
    if (reset.phase === 'confirm' && reset.phrase.trim().toUpperCase() !== 'RESET') return;
    setReset((r) => ({ ...r, phase: 'running', done: [], failedAt: null }));
    const res = await runReset();
    if (res.failedAt) {
      setReset((r) => ({ ...r, phase: 'failed', done: res.done, failedAt: res.failedAt }));
    } else {
      setReset((r) => ({ ...r, phase: 'done', done: res.done, failedAt: null }));
      setLedgerRes(null);
      setSettleRes(null);
      setReconCount(null);
      markStale(false);
      await reload();
      flash('All ingested data deleted');
    }
  };

  const importDone = !!ledgerRes || !!settleRes || hasReport;

  return (
    <div style={{ minHeight: '100vh', background: C.pageBg, color: INK, fontSize: 14, lineHeight: 1.45 }}>
      <Header onRefresh={onRefresh} />

      <ImportZone
        hasReport={hasReport}
        importOpen={effImportOpen}
        onCollapse={() => setImportOpen(false)}
        onExpand={() => setImportOpen(true)}
        collapsedSummary={`${data.model ? data.model.ledger.length : 0} ledger · ${data.model ? data.model.settle.length : 0} settlements · ${reconCount ?? (data.model ? data.model.rows.length : 0)} reconciled records`}
        error={importErr}
        onDismissError={() => setImportErr(null)}
        ledger={{ busy: busy === 'ledger', result: ledgerRes, entriesOpen: ledgerEntriesOpen, onToggleEntries: () => setLedgerEntriesOpen((v) => !v), onFile: handleLedgerFile }}
        settle={{ busy: busy === 'settle', result: settleRes, entriesOpen: settleEntriesOpen, onToggleEntries: () => setSettleEntriesOpen((v) => !v), onFile: handleSettleFile }}
        run={{
          onRun,
          disabled: !importDone || busy === 'run',
          label: busy === 'run' ? 'Reconciling…' : reconCount != null || hasReport ? 'Re-run reconciliation' : 'Run reconciliation',
          reconLine: reconCount != null ? `${reconCount} reconciled records created` : null,
        }}
        reset={{
          disabled: !importDone,
          onOpen: () => setReset({ open: true, phase: 'confirm', phrase: '', done: [], failedAt: null }),
          hint: !importDone ? 'Nothing imported yet — there is nothing to delete.' : 'Deletes reconciliations and both source datasets on the server. Irreversible.',
        }}
      />

      {data.status === 'loading' && <div style={{ padding: '72px 28px', color: INK2 }}>Loading reconciliation…</div>}

      {data.status === 'error' && (
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '64px 28px' }}>
          <div role="alert" style={{ padding: '16px 18px', background: '#fdecec', border: '1px solid #f2d2d2', borderRadius: 8, color: '#7a1f24' }}>
            <strong>Could not load the report.</strong>
            <p style={{ margin: '6px 0 12px', fontSize: 13 }}>{data.error?.message}</p>
            <Btn onClick={reload} style={{ border: `1px solid ${ACCENT}`, background: ACCENT, color: '#fff', padding: '7px 12px', fontSize: 13, borderRadius: 6, cursor: 'pointer' }} hoverStyle={{ background: '#2a55bd' }}>
              Retry
            </Btn>
          </div>
        </main>
      )}

      {data.status === 'empty' && <EmptyState />}

      {data.status === 'ready' && (
        <Report
          model={data.model}
          tab={tab}
          nav={nav}
          br={br}
          setBr={setBr}
          tx={tx}
          setTx={setTx}
          expanded={expanded}
          setExpanded={setExpanded}
          stale={stale}
          onRun={onRun}
          dismissStale={() => markStale(false)}
          flash={flash}
        />
      )}

      <ResetModal
        open={reset.open}
        phase={reset.phase}
        phrase={reset.phrase}
        setPhrase={(v) => setReset((r) => ({ ...r, phrase: v }))}
        done={reset.done}
        failedAt={reset.failedAt}
        onConfirm={confirmReset}
        onClose={() => reset.phase !== 'running' && setReset((r) => ({ ...r, open: false }))}
      />

      <Toast message={toast} />
    </div>
  );
}
