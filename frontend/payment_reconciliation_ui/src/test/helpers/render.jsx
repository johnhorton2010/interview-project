import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleModel } from './model.js';
import { BR_DEFAULTS, TX_DEFAULTS, MR_DEFAULTS } from './state.js';
import BreaksTab from '../../components/report/BreaksTab.jsx';
import TransactionsTab from '../../components/report/TransactionsTab.jsx';
import MerchantTable from '../../components/report/MerchantTable.jsx';
import CategoryTable from '../../components/report/CategoryTable.jsx';
import QuarantineTab from '../../components/report/QuarantineTab.jsx';

/**
 * The report tabs are controlled components: `br`/`setBr`, `tx`/`setTx`, `mr`/`setMr` and
 * `expanded`/`setExpanded` all live in App, and every interaction inside a tab is a call
 * back up into them. Rendering a tab with plain object props therefore freezes it — a
 * click on a sort header calls setBr and nothing re-renders, so the test passes while
 * asserting nothing. This harness owns the state a tab needs so the real interaction runs
 * end to end.
 *
 * `box` is the escape hatch for the assertions that are about state rather than pixels,
 * e.g. "clearing the filters must not touch the sort".
 */
function Harness({ initial, initialExpanded, box, children }) {
  const [state, setState] = useState(initial);
  const [expanded, setExpanded] = useState(initialExpanded);
  box.state = state;
  box.expanded = expanded;
  return children({ state, setState, expanded, setExpanded });
}

export function renderControlled(initial, children, { expanded = null } = {}) {
  const box = { state: initial, expanded };
  const user = userEvent.setup();
  const view = render(
    <Harness initial={initial} initialExpanded={expanded} box={box}>
      {children}
    </Harness>,
  );
  return { ...view, user, box };
}

export const navStub = () => ({
  goTab: vi.fn(),
  toBreaks: vi.fn(),
  toTransactions: vi.fn(),
  toQuarantine: vi.fn(),
});

export function renderBreaks({ model = sampleModel(), br, expanded = null, flash = vi.fn() } = {}) {
  const out = renderControlled(
    { ...BR_DEFAULTS, ...br },
    ({ state, setState, expanded: exp, setExpanded }) => (
      <BreaksTab model={model} br={state} setBr={setState} expanded={exp} setExpanded={setExpanded} flash={flash} />
    ),
    { expanded },
  );
  return { ...out, model, flash, table: () => screen.getByRole('table', { name: 'Breaks' }) };
}

export function renderTransactions({ model = sampleModel(), tx, expanded = null, flash = vi.fn() } = {}) {
  const out = renderControlled(
    { ...TX_DEFAULTS, ...tx },
    ({ state, setState, expanded: exp, setExpanded }) => (
      <TransactionsTab model={model} tx={state} setTx={setState} expanded={exp} setExpanded={setExpanded} flash={flash} />
    ),
    { expanded },
  );
  // The two accessible names are how the Ledger/Settlement toggle is asserted.
  return { ...out, model, flash, table: () => screen.getByRole('table', { name: /^Transactions by/ }) };
}

export function renderMerchants({ model = sampleModel(), mr, flash = vi.fn(), nav = navStub() } = {}) {
  const out = renderControlled({ ...MR_DEFAULTS, ...mr }, ({ state, setState }) => (
    <MerchantTable model={model} nav={nav} mr={state} setMr={setState} flash={flash} />
  ));
  return { ...out, model, flash, nav, table: () => screen.getByRole('table', { name: 'Merchant rollup' }) };
}

export function renderCategories({ model = sampleModel(), flash = vi.fn(), nav = navStub() } = {}) {
  const user = userEvent.setup();
  const view = render(<CategoryTable model={model} nav={nav} flash={flash} />);
  return { ...view, user, model, flash, nav, table: () => screen.getByRole('table', { name: 'Reconciliation Summary' }) };
}

export function renderQuarantine({ model = sampleModel(), expanded = null, flash = vi.fn() } = {}) {
  const out = renderControlled(
    null,
    ({ expanded: exp, setExpanded }) => <QuarantineTab model={model} expanded={exp} setExpanded={setExpanded} flash={flash} />,
    { expanded },
  );
  return { ...out, model, flash, table: () => screen.getByRole('table', { name: 'Quarantined Records' }) };
}

// ---- row queries ------------------------------------------------------------
// Every table puts role="row" on its header, its body rows AND its Total / Subtotal /
// Grand total rows, so a bare getAllByRole('row').length is never the row count.

const isHeader = (row) => within(row).queryAllByRole('columnheader').length > 0;

const isSummary = (row) =>
  /^(Total|Subtotal|Grand total)/.test(within(row).queryAllByRole('cell')[0]?.textContent ?? '');

/** Body rows only — no header, no subtotal, no total. */
export function dataRows(table) {
  return within(table)
    .getAllByRole('row')
    .filter((r) => !isHeader(r) && !isSummary(r));
}

/** The Total / Subtotal / Grand total rows, in document order. */
export function summaryRows(table) {
  return within(table).getAllByRole('row').filter(isSummary);
}

/** Text of column `i` down the body rows — the handle for every ordering assertion. */
export function columnText(table, i) {
  return dataRows(table).map((r) => within(r).getAllByRole('cell')[i]?.textContent ?? '');
}

export { screen, within, userEvent };
