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
npm run dev        # http://localhost:5173  (proxies APP_API_PREFIX → :8080)
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
npm test           # Vitest: domain suites (node) + component suites (jsdom)
npm run test:coverage   # same tests + V8 coverage report (terminal + coverage/index.html)
```

The domain tests assert the exact figures from the sample dataset (expected payout
$5,095.36, actual $5,161.00, discrepancy −$65.64, total fees $151.74, 8 breaks) and the
per-category / per-merchant sums.

The component tests (`*.test.jsx`) render against that same fixture and drive real
interactions — sorting, filtering, the Ledger/Settlement view switch, row expansion, CSV
export — plus `App.test.jsx`, which exercises load, import, run and reset flows end to end
with only `fetch` stubbed. Nothing under `src/` is mocked: `src/test/setup.js` stubs the
browser APIs jsdom lacks (canvas text measurement for `styles/columns.js`, object URLs and
anchor downloads for `downloadCsv`, `scrollIntoView`, `ResizeObserver`, `Blob.text`), so
the components run their real code paths. Only `*.test.jsx` files take jsdom; the domain
suites stay on the `node` environment.

Coverage is reported, not gated — no thresholds are configured. Known and deliberate gaps:
hover/`style` branches on `Btn` and `HoverRow`, `ColumnTip`'s flip-upward path (it needs a
real viewport bottom, which jsdom cannot provide), the `uploadSettlements`/`apiPutJson`
wrappers around the shared client, and a handful of defensive `|| 0` fallbacks.

## Build

```bash
npm run build      # → dist/
npm run preview
```

## Configuration

- `VITE_API_BASE_URL` (default `http://localhost:8080`) — the backend the Vite dev
  proxy forwards the API prefix to. See `.env.example`.
- `APP_API_PREFIX` (default `/api/v1`) — read from the **repo-root** `.env`, the one
  place the prefix is defined; Spring maps its controllers under it and the nginx proxy
  matches it. Vite bakes it into the bundle at build time, so changing it means a
  restart of `npm run dev` (or `docker compose up --build` for the container).

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
                quarantine.js  why a record was withheld, and which field failed
                categories.js  category label/severity/copy
                format.js      currency/date/CSV helpers
  components/   React UI (inline styles ported from the design)
                ImportZone, ResetModal, BreakDetail, QuarantineDetail,
                DetailPanels, common
                report/        Report, CategoryTable, MerchantTable, BreaksTab,
                               TransactionsTab, QuarantineTab, TableParts,
                               SearchHelp
  styles/       tokens.js      colors, fonts, severity encoding
                columns.js     one grid template per table, so every row lines up
                table.js       row chrome + the value→ink rules
                global.css     resets and keyframes
  test/         golden fixtures + the sample-payload builder
                setup.js       browser stubs jsdom lacks
                helpers/       model + prop factories, controlled-render harness,
                               fetch router, CSV download capture
```

All report maths live in `domain/selectors.js` as pure functions of the normalised
model — unit-tested against the sample fixtures. If a number is wrong, it is wrong in
one file. Money is handled in integer cents throughout and formatted once, at render.

## Notes & deliberate choices

- **Design vs. PRD divergences** (design wins for the visible surface): the quarantine
  tile counts withheld records on *both* sides (5 in the sample, vs. the PRD's ledger-only
  3); a fully-quarantined merchant appears as a muted `N/A` row rather than being omitted.
  These are documented in the domain tests.
- **Reset** (`FR-9`): shipped. The three `DELETE` endpoints are live, so **Reset data** in
  the import zone clears reconciliations, then the ledger, then settlements, behind a
  typed-`RESET` confirmation. A failure halts the sequence and the dialog reports each
  dataset as cleared, failed or not attempted (FR-9.3). On success the app returns to a
  cold-load state — filters, sort, expanded row and tab are all reset (FR-9.4), so the
  next import cannot inherit a silent filter. The deletes return `{ record_count }`,
  which the dialog does not currently surface.
- **Unknown categories** (e.g. a backend-internal `IN_PROGRESS`) are retained with a
  neutral badge and the raw label rather than crashing — forward-compatible. None is
  suppressed: the headline figures count such a record either way, so hiding its Summary
  row would leave the Total disagreeing with the rows above it and mask the backend bug
  that produced it.
- **Every category gets a Summary row**, whether or not this dataset populates it. The
  list comes from `CATS`, not from what arrived, and a category the run found nothing for
  reads `0` and `$0.00` — an absent row would say "not checked", which is the opposite.
- **Staleness**: importing after a report was rendered flags the report as stale
  (persisted to `sessionStorage`); reconciliation only runs on an explicit click.
- **Deferred** (not in this pass): React Router deep-links, the density (compact) toggle.
  MSW is still unused — the component suites stub `fetch` at the single chokepoint in
  `api/client.js` instead, which keeps the real client error handling under test.
```
