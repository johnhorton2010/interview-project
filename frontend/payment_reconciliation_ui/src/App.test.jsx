// App end to end with `fetch` stubbed at the single chokepoint in api/client.js. Every
// other layer is the real thing — the api modules, normalize(), the real `nav`, and all
// five tabs — so these are the only tests that cover what a cross-tab jump or a reset
// actually does to the app's state.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { mockApi, fail, offline } from './test/helpers/api.js';
import { API_PREFIX } from './api/client.js';
import { buildSamplePayload, emptyPayload } from './test/helpers/model.js';
import { dataRows } from './test/helpers/render.jsx';

afterEach(() => vi.unstubAllGlobals());

const ready = (routes = {}) => mockApi({ 'GET /reconciliations': buildSamplePayload(), ...routes });

/** Render and wait for the report to land. */
const renderReady = async (routes) => {
  const api = ready(routes);
  const view = render(<App />);
  await screen.findByRole('table', { name: 'Reconciliation Summary' });
  return { ...view, api, user: userEvent.setup() };
};

const fileInputs = () => [...document.querySelectorAll('input[type="file"]')];
const table = (name) => screen.getByRole('table', { name });
const csvFile = () => new File(['id,amount\n1,2\n'], 'internal_transactions.csv', { type: 'text/csv' });

describe('App', () => {
  describe('initial load', () => {
    it('shows a loading line, then the report', async () => {
      const api = ready();
      render(<App />);

      expect(screen.getByText('Loading reconciliation…')).toBeInTheDocument();
      expect(await screen.findByRole('table', { name: 'Reconciliation Summary' })).toBeInTheDocument();
      expect(api.keys()).toEqual(['GET /reconciliations']);
    });

    it('collapses the import zone once a report exists', async () => {
      await renderReady();
      expect(screen.getByText('18 ledger · 19 settlements · 19 reconciled records')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Import' })).not.toBeInTheDocument();
    });

    it('reopens the import zone on demand', async () => {
      const { user } = await renderReady();
      await user.click(screen.getByText('Open import'));
      expect(screen.getByRole('heading', { name: 'Import' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Collapse' }));
      expect(screen.queryByRole('heading', { name: 'Import' })).not.toBeInTheDocument();
    });

    it('offers the three onboarding steps when nothing has been imported', async () => {
      mockApi({ 'GET /reconciliations': emptyPayload() });
      render(<App />);

      expect(await screen.findByRole('heading', { name: 'No reconciliation yet' })).toBeInTheDocument();
      expect(screen.getByText('Import the Internal Ledger CSV.')).toBeInTheDocument();
      // Nothing to collapse behind, so the import zone stays open.
      expect(screen.getByRole('heading', { name: 'Import' })).toBeInTheDocument();
    });
  });

  describe('load failures', () => {
    it('names the backend when it cannot be reached, and retries', async () => {
      const api = mockApi({ 'GET /reconciliations': offline() });
      const user = userEvent.setup();
      render(<App />);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Could not load the report.');
      expect(alert).toHaveTextContent('Is the backend running on :8080?');

      api.setRoute('GET /reconciliations', buildSamplePayload());
      await user.click(within(alert).getByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('table', { name: 'Reconciliation Summary' })).toBeInTheDocument();
    });

    it('reports a server error with its status', async () => {
      mockApi({ 'GET /reconciliations': fail(500, 'kaboom') });
      render(<App />);

      expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500 Error).');
    });
  });

  describe('cross-tab navigation', () => {
    it('opens the breaks list from the headline tile and scrolls to the tabs', async () => {
      const { user } = await renderReady();

      await user.click(screen.getByText('Breaks').closest('button'));

      expect(table('Breaks')).toBeInTheDocument();
      expect(dataRows(table('Breaks'))).toHaveLength(8);
      await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    });

    it('carries a merchant filter from the Merchants tab into Breaks', async () => {
      const { user } = await renderReady();

      await user.click(screen.getByText('Merchants · 8'));
      await user.click(within(table('Merchant rollup')).getByText('MERCH-004'));

      expect(screen.getByText(/merchant: MERCH-004/)).toBeInTheDocument();
      expect(dataRows(table('Breaks'))).toHaveLength(3);
    });

    it('carries a category filter from the Summary tab into Breaks', async () => {
      const { user } = await renderReady();

      await user.click(within(table('Reconciliation Summary')).getByText('Duplicate settlement'));

      expect(screen.getByText(/category: Duplicate settlement/)).toBeInTheDocument();
      expect(dataRows(table('Breaks'))).toHaveLength(1);
    });

    it('sends clean matches to the Transactions tab instead', async () => {
      const { user } = await renderReady();

      await user.click(within(table('Reconciliation Summary')).getByText('Clean match'));

      expect(table('Transactions by ledger transaction')).toBeInTheDocument();
      expect(screen.getByText(/category: Clean match/)).toBeInTheDocument();
    });

    it('opens the payout terms on the transactions behind them', async () => {
      const { user } = await renderReady();

      // Scoped: the Summary table's Total row prints the same figure.
      const payout = screen.getByRole('region', { name: 'Payout derivation' });
      await user.click(within(payout).getByText('$6,804.12'));

      expect(table('Transactions by ledger transaction')).toBeInTheDocument();
      expect(screen.getByText(/type: Sales/)).toBeInTheDocument();
    });

    it('resets the breaks view on every fresh jump into it', async () => {
      // Arriving from elsewhere must not inherit the search and sort left behind last
      // time, or the destination silently hides rows the caller meant to show.
      const { user } = await renderReady();

      await user.click(screen.getByText('Breaks · 8'));
      await user.type(screen.getByPlaceholderText(/Search id, merchant/), 'TXN-000012');
      expect(dataRows(table('Breaks'))).toHaveLength(1);

      await user.click(screen.getByText('Summary'));
      await user.click(within(table('Reconciliation Summary')).getByText('Duplicate settlement'));

      expect(screen.getByPlaceholderText(/Search id, merchant/)).toHaveValue('');
      expect(screen.getByText(/category: Duplicate settlement/)).toBeInTheDocument();
    });
  });

  describe('import', () => {
    it('uploads a ledger file and marks the report stale', async () => {
      const { api, user } = await renderReady({
        'PUT /ledger-transactions': { 'TXN-000001': 'INSERTED_OR_UPDATED', 'TXN-000002': 'NO_CHANGE' },
      });

      await user.click(screen.getByText('Open import'));
      fireEvent.change(fileInputs()[0], { target: { files: [csvFile()] } });

      expect(await screen.findByText('2 transactions accepted — 1 new or updated, 1 unchanged')).toBeInTheDocument();
      expect(api.keys()).toContain('PUT /ledger-transactions');
      expect(api.calls.at(-1).body).toBeInstanceOf(FormData);

      expect(screen.getByText(/You have imported data since the last reconciliation/)).toBeInTheDocument();
      expect(sessionStorage.getItem('recon.stale')).toBe('1');
    });

    it('refuses a non-CSV ledger file without contacting the server', async () => {
      const { api, user } = await renderReady();

      await user.click(screen.getByText('Open import'));
      fireEvent.change(fileInputs()[0], {
        target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] },
      });

      expect(await screen.findByRole('alert')).toHaveTextContent('Expected a .csv file (the internal ledger export).');
      expect(api.keys()).toEqual(['GET /reconciliations']);
    });

    it('refuses a settlement file that is not a JSON array', async () => {
      const { api, user } = await renderReady();

      await user.click(screen.getByText('Open import'));
      fireEvent.change(fileInputs()[1], {
        target: { files: [new File(['{}'], 'settlements.json', { type: 'application/json' })] },
      });

      expect(await screen.findByRole('alert')).toHaveTextContent('The settlement file must be a JSON array at its root.');
      expect(api.keys()).toEqual(['GET /reconciliations']);
    });

    it('refuses a settlement record with no network ref', async () => {
      const { user } = await renderReady();

      await user.click(screen.getByText('Open import'));
      fireEvent.change(fileInputs()[1], {
        target: { files: [new File(['[{"amount": 1}]'], 'settlements.json', { type: 'application/json' })] },
      });

      expect(await screen.findByRole('alert')).toHaveTextContent('Element at index 0 is missing a non-empty "network_ref".');
    });

    it('surfaces a rejected upload with its status, and dismisses it', async () => {
      const { user } = await renderReady({ 'PUT /ledger-transactions': fail(415, 'bad csv') });

      await user.click(screen.getByText('Open import'));
      fireEvent.change(fileInputs()[0], { target: { files: [csvFile()] } });

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Ledger import failed (415). bad csv');

      // Scoped: the stale banner renders another control labelled "Dismiss".
      await user.click(within(alert).getByLabelText('Dismiss'));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('run reconciliation', () => {
    it('runs, reloads, clears the stale flag and returns to the Summary tab', async () => {
      const { api, user } = await renderReady({
        'POST /reconciliations': { record_count: 19 },
        'PUT /ledger-transactions': { 'TXN-000001': 'INSERTED_OR_UPDATED' },
      });

      await user.click(screen.getByText('Open import'));
      fireEvent.change(fileInputs()[0], { target: { files: [csvFile()] } });
      await screen.findByText(/You have imported data since the last reconciliation/);

      await user.click(screen.getByText('Breaks · 8'));
      await user.click(screen.getByRole('button', { name: 'Run reconciliation' }));

      expect(await screen.findByText('19 reconciled records created')).toBeInTheDocument();
      expect(api.keys().filter((k) => k === 'POST /reconciliations')).toHaveLength(1);
      expect(api.keys().filter((k) => k === 'GET /reconciliations')).toHaveLength(2); // initial + reload
      expect(screen.queryByText(/You have imported data since the last reconciliation/)).not.toBeInTheDocument();
      expect(sessionStorage.getItem('recon.stale')).toBe('0');
      expect(table('Reconciliation Summary')).toBeInTheDocument();
    });
  });

  describe('reset', () => {
    const deletes = {
      'DELETE /reconciliations': {},
      'DELETE /ledger-transactions': {},
      'DELETE /processor-settlement-transactions': {},
    };

    const openAndConfirm = async (user) => {
      await user.click(screen.getByText('Open import'));
      await user.click(screen.getByRole('button', { name: 'Reset data' }));
      await user.type(screen.getByLabelText('Type RESET to confirm'), 'RESET');
      await user.click(screen.getByRole('button', { name: 'Delete everything' }));
    };

    it('deletes in dependency order and returns the app to its empty state', async () => {
      const { api, user } = await renderReady(deletes);

      // Leave the app somewhere non-default first: FR-9.4 is about this being undone.
      await user.click(screen.getByText('Merchants · 8'));
      await user.click(within(table('Merchant rollup')).getByText('MERCH-004'));
      expect(screen.getByText(/merchant: MERCH-004/)).toBeInTheDocument();

      api.setRoute('GET /reconciliations', emptyPayload());
      await openAndConfirm(user);

      expect(await screen.findByText('All ingested data deleted')).toBeInTheDocument();
      expect(api.keys().filter((k) => k.startsWith('DELETE'))).toEqual([
        'DELETE /reconciliations',
        'DELETE /ledger-transactions',
        'DELETE /processor-settlement-transactions',
      ]);

      await user.click(screen.getByRole('button', { name: 'Done' }));

      expect(screen.getByRole('heading', { name: 'No reconciliation yet' })).toBeInTheDocument();
      expect(screen.queryByText(/merchant: MERCH-004/)).not.toBeInTheDocument();
      expect(sessionStorage.getItem('recon.stale')).toBe('0');
    });

    it('halts on the first failure, leaving the report and its filters alone', async () => {
      // FR-9.3: what survived is exactly what the analyst can still see.
      const { user } = await renderReady({ ...deletes, 'DELETE /ledger-transactions': fail(500, 'nope') });

      await user.click(screen.getByText('Merchants · 8'));
      await user.click(within(table('Merchant rollup')).getByText('MERCH-004'));

      await openAndConfirm(user);

      // The phrase titles the dialog and heads its error panel, so assert on the dialog.
      await waitFor(() => expect(screen.getByRole('dialog')).toHaveAccessibleName('Reset did not complete'));
      expect(screen.getByRole('status')).toHaveTextContent(`DELETE ${API_PREFIX}/ledger-transactions returned 500 — nope`);

      await user.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(table('Breaks')).toBeInTheDocument();
      expect(screen.getByText(/merchant: MERCH-004/)).toBeInTheDocument();
    });
  });

  it('clears a toast after its 2.4s life', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const api = ready();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);
      await screen.findByRole('table', { name: 'Reconciliation Summary' });

      await user.click(screen.getByRole('button', { name: 'Refresh' }));

      expect(await screen.findByText(`Refreshed — GET ${API_PREFIX}/reconciliations`)).toBeInTheDocument();
      expect(api.keys().filter((k) => k === 'GET /reconciliations')).toHaveLength(2);

      await act(async () => {
        vi.advanceTimersByTime(2400);
      });
      expect(screen.queryByText(`Refreshed — GET ${API_PREFIX}/reconciliations`)).not.toBeInTheDocument();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
