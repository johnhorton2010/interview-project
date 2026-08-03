import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getReconciliations, runReconciliation } from './api/reconciliations.js';
import { validateLedgerFile, uploadLedger } from './api/ledger.js';
import { validateSettlementFile, parseAndValidateSettlements, uploadSettlements } from './api/settlements.js';
import { API_PREFIX, summarizeStatuses, describeApiError } from './api/client.js';
import { runReset, RESET_STEPS } from './api/reset.js';
import { normalize } from './domain/normalize.js';
import { C, MONO, INK, INK2, ACCENT } from './styles/tokens.js';
import { Toast, Btn, Alert } from './components/common.jsx';
import ImportZone from './components/ImportZone.jsx';
import ResetModal from './components/ResetModal.jsx';
import Report from './components/report/Report.jsx';

const STALE_KEY = 'recon.stale';

// Pristine view state for the two report tabs. Shared by the initial mount and by the
// FR-9 reset, so "returns to its empty state" cannot drift from what a cold load gives.
const BR_DEFAULTS = { query: '', catFilter: [], merchantFilter: null, sortKey: 'impact', sortDir: 'desc', catOpen: false, helpOpen: false };
const TX_DEFAULTS = { query: '', cats: [], type: 'all', view: 'ledger', sortKey: 'disc', sortDir: 'desc', catOpen: false, helpOpen: false };
const INITIAL_TAB = 'categories';
// Merchants view state. `breaksOnly` is off by default: every merchant is worth seeing,
// and each row navigates somewhere useful whether it has breaks, none, or only
// quarantined records. Grouped like BR/TX so the FR-9.4 reset stays one line per tab.
const MR_DEFAULTS = { query: '', breaksOnly: false };

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
    ['01', 'Import the Internal Ledger CSV.', 'The file is sent as selected — nothing is parsed or reordered in the browser.'],
    ['02', 'Import the Processor Settlement JSON.', 'Validated as a non-empty array of objects with a network ref, then passed through unmodified.'],
    ['03', 'Run reconciliation.', "Matches transactions and categorizes the results."],
  ];
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '72px 28px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>No reconciliation yet</h1>
      <p style={{ margin: '0 0 32px', color: INK2, maxWidth: '52ch', textWrap: 'pretty' }}>Three simple steps to generate a report.</p>
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
  const [tab, setTab] = useState(INITIAL_TAB);
  const [expanded, setExpanded] = useState(null);
  const [toast, setToast] = useState(null);
  const [br, setBr] = useState(BR_DEFAULTS);
  const [tx, setTx] = useState(TX_DEFAULTS);
  // Lifted out of MerchantTable so deliberate filters survive leaving the tab.
  const [mr, setMr] = useState(MR_DEFAULTS);
  const [reset, setReset] = useState({ open: false, phase: 'confirm', phrase: '', done: [], failedAt: null, error: null });

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

  /** @returns {Promise<boolean>} whether the report was refreshed — callers must not
   *  report success without checking, which is what the Refresh button used to do. */
  const reload = useCallback(async () => {
    try {
      const payload = await getReconciliations();
      const model = normalize(payload);
      setData({ status: model.rows.length ? 'ready' : 'empty', model, error: null });
      return true;
    } catch (e) {
      // Keep the last good model. A blip on Refresh used to blank the report and every
      // filter the analyst had set, so a recoverable failure cost them their place.
      setData((d) => ({ status: 'error', model: d.model, error: e }));
      return false;
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // A failed reload keeps the last good model, so what the page shows follows the model
  // and only a cold failure — nothing ever loaded — takes the page over. Everything that
  // asks "is a report on screen?" reads this rather than `status`, so a transient error
  // cannot re-open the import zone or disable the reset behind the analyst's back.
  const view = data.model ? (data.model.rows.length ? 'ready' : 'empty') : data.status;
  const hasReport = view === 'ready';
  const staleReport = data.status === 'error' && !!data.model;
  const effImportOpen = importOpen === null ? !hasReport : importOpen;

  // Every nav jump scrolls the tab strip into view, but only after the destination tab has
  // rendered — scrolling first lands on the old layout. This used to be a bare 40ms
  // setTimeout, which is a guess at how long a render takes and got slower as the tables
  // grew. `navSeq` rather than `tab` as the trigger because re-selecting the tab you are
  // already on is still a jump worth scrolling for.
  const [navSeq, setNavSeq] = useState(0);
  useEffect(() => {
    if (navSeq === 0) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById('report-tabs')
      ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, [navSeq]);

  // Stable identities: `nav` used to be a fresh object of fresh closures on every render,
  // which would defeat React.memo on Report and hand every tab a changed prop each time a
  // toast appeared.
  const goTab = useCallback((t) => {
    setTab(t);
    setNavSeq((n) => n + 1);
  }, []);

  const toBreaks = useCallback((patch = {}) => {
    const { expanded: exp, ...rest } = patch;
    setBr((b) => ({ ...b, query: '', catFilter: [], merchantFilter: null, sortKey: 'impact', sortDir: 'desc', ...rest }));
    setExpanded(exp ?? null);
    setTab('breaks');
    setNavSeq((n) => n + 1);
  }, []);

  const toTransactions = useCallback((patch = {}) => {
    setTx((t) => ({ ...t, query: '', cats: [], type: 'all', view: 'ledger', sortKey: 'disc', sortDir: 'desc', ...patch }));
    setExpanded(null);
    setTab('transactions');
    setNavSeq((n) => n + 1);
  }, []);

  const toQuarantine = useCallback(() => {
    setExpanded(null);
    setTab('quarantine');
    setNavSeq((n) => n + 1);
  }, []);

  const nav = useMemo(
    () => ({ goTab, toBreaks, toTransactions, toQuarantine }),
    [goTab, toBreaks, toTransactions, toQuarantine],
  );

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
      setImportErr(describeApiError(e, 'Ledger import'));
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
      setImportErr(describeApiError(e, 'Settlement import'));
    } finally {
      setBusy(null);
    }
  };

  const onRun = useCallback(async () => {
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
      setImportErr(describeApiError(e, 'Reconciliation'));
      // The import zone is the only surface that renders importErr, and it is collapsed
      // after the first successful run — while the stale banner keeps offering its own
      // "Run reconciliation". Without this a failed re-run from there says nothing at all.
      setImportOpen(true);
    } finally {
      setBusy(null);
    }
  }, [busy, reload, markStale, flash]);

  const dismissStale = useCallback(() => markStale(false), [markStale]);

  const onRefresh = async () => {
    // Only on success: the banner reload() raises is the feedback when it fails.
    if (await reload()) flash(`Refreshed — GET ${API_PREFIX}/reconciliations`);
  };

  const confirmReset = async () => {
    if (reset.phase === 'confirm' && reset.phrase.trim().toUpperCase() !== 'RESET') return;
    setReset((r) => ({ ...r, phase: 'running', done: [], failedAt: null, error: null }));
    // runReset reports each step as it *begins*. The sequence is strictly ordered and
    // halts on the first failure, so every earlier step has cleared by then — which is
    // what the modal wants: it marks the step after the last cleared one as deleting.
    // Without this `done` stayed empty until the whole run resolved, so all three
    // endpoints sat on the first one's spinner however long the deletes took.
    const res = await runReset((key) => {
      const i = RESET_STEPS.findIndex((st) => st.key === key);
      setReset((r) => ({ ...r, done: RESET_STEPS.slice(0, i).map((st) => st.key) }));
    });
    if (res.failedAt) {
      // A halted sequence leaves the report and the analyst's filters alone: they are
      // what shows which datasets survived (FR-9.3).
      setReset((r) => ({ ...r, phase: 'failed', done: res.done, failedAt: res.failedAt, error: res.error }));
    } else {
      setReset((r) => ({ ...r, phase: 'done', done: res.done, failedAt: null, error: null }));
      // FR-9.4: return to the empty state. Every piece of view state below outlives the
      // records it refers to, so leaving any of it would silently filter or pre-expand
      // the *next* import's report with no visible cause. `reset.phase`/`done` are
      // deliberately kept — the modal still renders its summary until dismissed.
      setLedgerRes(null);
      setSettleRes(null);
      setReconCount(null);
      setLedgerEntriesOpen(false);
      setSettleEntriesOpen(false);
      setImportErr(null);
      setImportOpen(null); // null → re-derive from hasReport, i.e. open again while empty
      setTab(INITIAL_TAB);
      setExpanded(null);
      setBr(BR_DEFAULTS);
      setTx(TX_DEFAULTS);
      setMr(MR_DEFAULTS);
      markStale(false);
      await reload();
      flash('All data deleted');
    }
  };

  const importDone = !!ledgerRes || !!settleRes || hasReport;

  // Shared by the cold-failure page and the banner over a surviving report — the same
  // action either way, so it should not be two buttons that can drift apart.
  const retryButton = (
    <Btn onClick={reload} style={{ border: `1px solid ${ACCENT}`, background: ACCENT, color: '#fff', padding: '7px 12px', fontSize: 13, borderRadius: 6, cursor: 'pointer' }} hoverStyle={{ background: '#2a55bd' }}>
      Retry
    </Btn>
  );

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
          onOpen: () => setReset({ open: true, phase: 'confirm', phrase: '', done: [], failedAt: null, error: null }),
          hint: !importDone ? 'Nothing imported yet — there is nothing to delete.' : 'Deletes previously imported internal ledger entries, processor settlements, and reconciliations. This is an irreversible operation.',
        }}
      />

      {view === 'loading' && <div style={{ padding: '72px 28px', color: INK2 }}>Loading reconciliation…</div>}

      {view === 'error' && (
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '64px 28px' }}>
          <Alert title="Could not load the report." actions={retryButton}>
            {data.error?.message}
          </Alert>
        </main>
      )}

      {/* A reload that failed over a report already on screen: say so above it rather than
          replacing it, since everything below is still the last figures the backend gave. */}
      {staleReport && (
        <div style={{ padding: '18px 28px 0' }}>
          <Alert
            title="Could not refresh the report."
            actions={retryButton}
            onDismiss={() => setData((d) => ({ ...d, status: d.model.rows.length ? 'ready' : 'empty', error: null }))}
          >
            {data.error?.message} The figures below are from the last successful load.
          </Alert>
        </div>
      )}

      {view === 'empty' && <EmptyState />}

      {view === 'ready' && (
        <Report
          model={data.model}
          tab={tab}
          nav={nav}
          br={br}
          setBr={setBr}
          tx={tx}
          setTx={setTx}
          mr={mr}
          setMr={setMr}
          expanded={expanded}
          setExpanded={setExpanded}
          stale={stale}
          onRun={onRun}
          dismissStale={dismissStale}
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
        error={reset.error}
        onConfirm={confirmReset}
        onClose={() => reset.phase !== 'running' && setReset((r) => ({ ...r, open: false }))}
      />

      <Toast message={toast} />
    </div>
  );
}
