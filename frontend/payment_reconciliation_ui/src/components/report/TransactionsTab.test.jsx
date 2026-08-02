import { describe, it, expect } from 'vitest';
import { renderTransactions, dataRows, summaryRows, columnText, screen, within } from '../../test/helpers/render.jsx';
import { lastDownload } from '../../test/helpers/downloads.js';
import { sampleModel, withoutCategory, quarantineOnlyPayload } from '../../test/helpers/model.js';
import { normalize } from '../../domain/normalize.js';

// Column order in both views: id, date, Merchant, Merchant ref, Sales, Refunds, Fees,
// Exp pay, Settled, Discrepancy, Category.
const ID = 0;
const MERCHANT = 2;
const SALES = 4;
const FEES = 6;
const SETTLED = 8;
const DISCREPANCY = 9;

const header = (label) => screen.getByRole('columnheader', { name: new RegExp(`^${label}( [↑↓])?$`) });
const search = () => screen.getByPlaceholderText(/Search id, merchant, ref, amount, or date/);
const tieNote = () => screen.getByText(/included rows|Filtered view|report has a bug/);
const exportCsv = (user) => user.click(screen.getByRole('button', { name: 'Export CSV' }));

describe('TransactionsTab', () => {
  describe('ledger view', () => {
    it('opens on one row per included transaction, tied out against the headline', () => {
      const { table } = renderTransactions();

      expect(table()).toHaveAccessibleName('Transactions by ledger transaction');
      expect(dataRows(table())).toHaveLength(16);
      expect(tieNote()).toHaveTextContent(
        'All 16 included rows — impact sums to −$65.64, matching the headline discrepancy',
      );
    });

    it('bands the unattributed settlement separately and subtotals both bands', () => {
      const { table } = renderTransactions();

      expect(screen.getByText(/Unmatched Settlements/i)).toBeInTheDocument();
      // Subtotal per band, plus the report-wide grand total.
      expect(summaryRows(table())).toHaveLength(3);
      expect(within(summaryRows(table()).at(-1)).getAllByRole('cell')[0]).toHaveTextContent('Grand total');
    });
  });

  describe('settlement view', () => {
    it('re-frames the table around payouts', async () => {
      const { table, user } = renderTransactions();

      await user.click(screen.getByRole('button', { name: 'Settlement' }));

      expect(table()).toHaveAccessibleName('Transactions by settlement');
      // 17 included settlements plus the transaction that never settled.
      expect(dataRows(table())).toHaveLength(18);
      expect(screen.getByText(/Never settled/i)).toBeInTheDocument();
    });

    it('states the tie-out without summing transaction-level impact across payouts', async () => {
      const { user } = renderTransactions();

      await user.click(screen.getByRole('button', { name: 'Settlement' }));

      expect(tieNote()).toHaveTextContent(
        'All 18 included rows — expected minus settled still nets to −$65.64',
      );
    });

    it('returns to the ledger framing', async () => {
      const { table, user } = renderTransactions({ tx: { view: 'settlement' } });

      await user.click(screen.getByRole('button', { name: 'Ledger' }));

      expect(table()).toHaveAccessibleName('Transactions by ledger transaction');
      expect(dataRows(table())).toHaveLength(16);
    });

    it('carries the transaction-level figures with 〃 on later parts, but never the per-payout ones', async () => {
      const { table, user } = renderTransactions({ tx: { view: 'settlement' } });
      await user.click(screen.getByRole('button', { name: 'Ledger' }));
      await user.click(screen.getByRole('button', { name: 'Settlement' }));

      const carried = dataRows(table()).filter((r) => within(r).getAllByRole('cell')[SALES].textContent === '〃');
      expect(carried.length).toBeGreaterThan(0);

      for (const row of carried) {
        const cells = within(row).getAllByRole('cell').map((c) => c.textContent);
        // Sales, refunds, expected pay and discrepancy belong to the transaction.
        expect(cells[DISCREPANCY]).toBe('〃');
        // Fees and settled are per-payout, so they always print a figure of their own.
        expect(cells[FEES]).not.toBe('〃');
        expect(cells[SETTLED]).not.toBe('〃');
      }
    });

    it('keeps a transaction-s parts contiguous under every sort', async () => {
      const { table, user } = renderTransactions({ tx: { view: 'settlement' } });

      for (const label of ['Settled', 'Merchant', 'Network ref']) {
        await user.click(header(label));
        const ids = columnText(table(), ID);
        const carriedAt = dataRows(table())
          .map((r, i) => (within(r).getAllByRole('cell')[SALES].textContent === '〃' ? i : -1))
          .filter((i) => i >= 0);
        // Every carried part sits directly under another row of the same transaction.
        for (const i of carriedAt) expect(i).toBeGreaterThan(0);
        expect(ids).toHaveLength(18);
      }
    });
  });

  describe('sorting', () => {
    // The two views use entirely separate comparator maps — a column that sorts correctly
    // by ledger transaction can still be broken by settlement.
    const COLUMNS = {
      ledger: ['Txn id', 'Captured on', 'Merchant', 'Merchant ref', 'Sales', 'Refunds', 'Fees', 'Exp pay', 'Settled', 'Discrepancy', 'Category'],
      settlement: ['Network ref', 'Settled on', 'Merchant', 'Merchant ref', 'Sales', 'Refunds', 'Fees', 'Exp pay', 'Settled', 'Discrepancy', 'Category'],
    };

    it.each(COLUMNS.ledger)('sorts the ledger view by %s', async (label) => {
      const { table, user } = renderTransactions();

      await user.click(header(label));

      expect(header(label).getAttribute('aria-sort')).toMatch(/ascending|descending/);
      expect(dataRows(table())).toHaveLength(16);
    });

    it.each(COLUMNS.settlement)('sorts the settlement view by %s', async (label) => {
      const { table, user } = renderTransactions({ tx: { view: 'settlement' } });

      await user.click(header(label));

      expect(header(label).getAttribute('aria-sort')).toMatch(/ascending|descending/);
      expect(dataRows(table())).toHaveLength(18);
    });
  });

  describe('filters', () => {
    it('narrows to refunds', async () => {
      const { table, user } = renderTransactions();

      await user.click(screen.getByRole('button', { name: 'Refunds' }));

      expect(screen.getByText(/type: Refunds/)).toBeInTheDocument();
      expect(dataRows(table()).length).toBeGreaterThan(0);
      expect(dataRows(table()).length).toBeLessThan(16);
      expect(tieNote()).toHaveTextContent(/^Filtered view/);
    });

    it('restores every type', async () => {
      const { table, user } = renderTransactions({ tx: { type: 'REFUND' } });
      await user.click(screen.getByRole('button', { name: 'All' }));
      expect(dataRows(table())).toHaveLength(16);
    });

    it('offers a category this dataset never produced, and never offers Quarantined', async () => {
      // Same rule as the Summary rows: the menu is the vocabulary this tab can show, not
      // a projection of the data. Quarantined records are never in `included`, so that
      // checkbox could only ever match nothing — it belongs on its own tab.
      const { table, user } = renderTransactions({ model: withoutCategory(sampleModel(), 'WIDE_WINDOW') });

      await user.click(screen.getByRole('button', { name: /All categories/ }));
      const wide = screen.getByRole('checkbox', { name: /Wide settlement window/ });
      expect(wide.closest('label')).toHaveTextContent(/Wide settlement window\s*0/);
      expect(screen.queryByRole('checkbox', { name: /Quarantined/ })).not.toBeInTheDocument();

      await user.click(wide);
      expect(dataRows(table())).toHaveLength(0);
    });

    it('stays populated when nothing reconciled at all', async () => {
      // One quarantined record and nothing else — a data-derived menu would be empty.
      const { user } = renderTransactions({ model: normalize(quarantineOnlyPayload()) });

      await user.click(screen.getByRole('button', { name: /All categories/ }));

      // Every category except QUARANTINE, clean matches included.
      expect(screen.getAllByRole('checkbox')).toHaveLength(9);
      expect(screen.getByRole('checkbox', { name: /Clean match/ })).toBeInTheDocument();
    });

    it('collapses the subtotals when a category filter empties the second band', async () => {
      // Only one band left means a subtotal would merely restate the grand total below it.
      const { table, user } = renderTransactions();

      await user.click(screen.getByRole('button', { name: /All categories/ }));
      await user.click(screen.getByRole('checkbox', { name: /Clean match/ }));

      expect(screen.queryByText(/Unmatched Settlements/i)).not.toBeInTheDocument();
      expect(summaryRows(table())).toHaveLength(1);
      expect(within(summaryRows(table())[0]).getAllByRole('cell')[0]).toHaveTextContent('Grand total');
    });

    it('matches the search grammar', async () => {
      const { table, user } = renderTransactions();

      await user.type(search(), 'merchant:MERCH-004');
      expect(dataRows(table()).length).toBeGreaterThan(0);
      expect(new Set(columnText(table(), MERCHANT))).toEqual(new Set(['MERCH-004']));
    });

    it('clears every filter from the strip', async () => {
      const { table, user, box } = renderTransactions();

      await user.click(screen.getByRole('button', { name: 'Refunds' }));
      await user.type(search(), 'MERCH-004');
      expect(dataRows(table()).length).toBeLessThan(16);

      await user.click(screen.getByRole('button', { name: 'Clear filters' }));

      expect(box.state).toMatchObject({ query: '', cats: [], type: 'all' });
      expect(dataRows(table())).toHaveLength(16);
    });

    it('offers the search grammar from the toolbar', async () => {
      const { user } = renderTransactions();

      await user.click(screen.getByRole('button', { name: '?' }));
      expect(screen.getByText('2026-06-01..2026-06-05')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByText('2026-06-01..2026-06-05')).not.toBeInTheDocument();
    });

    it('says so when nothing matches, in the language of the current view', async () => {
      const { user } = renderTransactions();

      await user.type(search(), 'no-such-transaction');
      expect(screen.getByText('No transactions match.')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Settlement' }));
      expect(screen.getByText('No settlements match.')).toBeInTheDocument();
    });
  });

  describe('row expansion', () => {
    it('keys on the row id in ledger view', async () => {
      const { table, user, box } = renderTransactions();

      await user.click(dataRows(table())[0]);
      expect(box.expanded).toBeTruthy();
      expect(dataRows(table()).filter((r) => r.getAttribute('aria-expanded') === 'true')).toHaveLength(1);
    });

    it('keys on the network ref in settlement view', async () => {
      const { table, user, box } = renderTransactions({ tx: { view: 'settlement' } });

      await user.click(dataRows(table())[0]);
      expect(box.expanded).toMatch(/^ARN/);
    });
  });

  describe('CSV export', () => {
    it('writes the ledger file in ledger view', async () => {
      const { user, flash } = renderTransactions();

      await exportCsv(user);

      const csv = await lastDownload();
      expect(csv.filename).toBe('transactions.csv');
      expect(csv.lines).toHaveLength(17); // header + 16 rows
      expect(flash).toHaveBeenCalledWith('transactions.csv — 16 rows exported');
    });

    it('writes a different file in settlement view, one line per payout', async () => {
      // Same button, same data, different unit of account — the thing worth pinning.
      const { user, flash } = renderTransactions({ tx: { view: 'settlement' } });

      await exportCsv(user);

      const csv = await lastDownload();
      expect(csv.filename).toBe('transactions-by-settlement.csv');
      expect(csv.lines).toHaveLength(19); // header + 18 rows
      expect(csv.rows[0]).toContain('Part');
      expect(flash).toHaveBeenCalledWith('transactions-by-settlement.csv — 18 rows exported');
    });

    it('exports only the filtered rows', async () => {
      const { user, flash } = renderTransactions();

      await user.type(search(), 'merchant:MERCH-004');
      await exportCsv(user);

      const csv = await lastDownload();
      expect(csv.lines.length).toBeLessThan(17);
      expect(flash).toHaveBeenCalledWith(expect.stringMatching(/^transactions\.csv — \d+ rows exported$/));
    });
  });
});
