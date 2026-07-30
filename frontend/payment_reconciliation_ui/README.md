# Settlement Reconciliation Console — Frontend

A React 18 + Vite single-page app that imports the two source files, triggers
reconciliation, and renders the report over the existing reconciliation API. It does
**no** matching and derives **no** categories — matching, tolerance and categorisation
are the backend's job; this is a presentation and workflow layer.

Built from the imported Claude Design project *"Hi-fi Payout Reconciliation Console"*
(`Reconciliation Console.dc.html`). The design is the source of truth for the UI; the
correctness rules follow the accompanying PRD.

## Prerequisites

- Node 18+ (developed on Node 24) and npm.
- The backend running on `http://localhost:8080` (see `../../backend/...`):
  ```bash
  cd ../../backend/payment_reconciliation
  ./gradlew bootRun
  ```
  It needs the repo-root `.env` (copy `.env.example`; H2 is in-memory, any user/pass).

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (proxies /api → :8080)
```

Then, in the app:

1. Drop `../../data/internal_transactions.csv` on the **Internal ledger** card.
2. Drop `../../data/processor_settlement.json` on the **Processor settlements** card.
3. Click **Run reconciliation**.
4. Read the report — tiles, payout waterfall, and the Summary / Merchants / Breaks /
   Transactions / Quarantine tabs. Expand any break for the two-sided detail.

Re-dropping the same file reports `0 new or updated, N unchanged` (idempotency proof).

## Test

```bash
npm test           # Vitest: money + normalisation + selector golden figures
```

The domain tests assert the exact figures from the sample dataset (expected payout
$5,095.36, actual $5,161.00, discrepancy −$65.64, total fees $151.74, 8 breaks) and the
per-category / per-merchant sums.

## Build

```bash
npm run build      # → dist/
npm run preview
```

## Configuration

- `VITE_API_BASE_URL` (default `http://localhost:8080`) — the backend the Vite dev
  proxy forwards `/api` to. See `.env.example`.

## Architecture

```
src/
  api/          fetch wrapper + one module per endpoint (ledger, settlements,
                reconciliations, reset)
  domain/       pure, React-free logic — the correctness core:
                money.js       integer-cent parsing/formatting (no float math)
                normalize.js   three-map payload → flat ReconRow[] (PRD §6)
                selectors.js   every figure: headline, category, merchant, search
                detail.js      two-sided break-detail view model
                categories.js  category label/severity/copy
                format.js      currency/date/CSV helpers
  components/   React UI (inline styles ported from the design)
                ImportZone, ResetModal, BreakDetail, common
                report/        Report, CategoryTable, MerchantTable,
                               BreaksTab, TransactionsTab, QuarantineTab
  styles/       tokens.js (colors/fonts), global.css
  test/         golden fixtures + the sample-payload builder
```

All report maths live in `domain/selectors.js` as pure functions of the normalised
model — unit-tested against the sample fixtures. If a number is wrong, it is wrong in
one file. Money is handled in integer cents throughout and formatted once, at render.

## Notes & deliberate choices

- **Design vs. PRD divergences** (design wins for the visible surface): the quarantine
  tile counts withheld records on *both* sides (5 in the sample, vs. the PRD's ledger-only
  3); a fully-quarantined merchant appears as an `N/A` row (hidden by the default "only
  merchants with breaks" toggle) rather than being omitted. These are documented in the
  domain tests.
- **Reset** (`FR-9`): shipped. The three `DELETE` endpoints are live, so **Reset data** in
  the import zone clears reconciliations, then the ledger, then settlements, behind a
  typed-`RESET` confirmation. A failure halts the sequence and the dialog reports each
  dataset as cleared, failed or not attempted (FR-9.3). On success the app returns to a
  cold-load state — filters, sort, expanded row and tab are all reset (FR-9.4), so the
  next import cannot inherit a silent filter. The deletes return `{ record_count }`,
  which the dialog does not currently surface.
- **Unknown categories** (e.g. a future `IN_PROGRESS`) are retained with a neutral badge
  and the raw label rather than crashing — forward-compatible.
- **Staleness**: importing after a report was rendered flags the report as stale
  (persisted to `sessionStorage`); reconciliation only runs on an explicit click.
- **Deferred** (not in this pass): React Router deep-links, MSW/component test suites,
  the density (compact) toggle.
```
