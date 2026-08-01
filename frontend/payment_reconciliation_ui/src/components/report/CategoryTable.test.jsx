import { describe, it, expect } from 'vitest';
import { renderCategories, dataRows, summaryRows, columnText, screen, within } from '../../test/helpers/render.jsx';
import { lastDownload } from '../../test/helpers/downloads.js';

// Column order: Category, Severity, Total n, Ldgr / Stl, Sales, Refunds, Fees, Exp pay,
// Settled, Discrepancy.
const CATEGORY = 0;
const TOTAL_N = 2;
const SALES = 4;
const IMPACT = 9;

const exportCsv = (table, user) =>
  user.click(within(table().closest('section')).getByRole('button', { name: 'Export CSV' }));

describe('CategoryTable', () => {
  it('lists every category, severity-ordered', () => {
    const { table } = renderCategories();

    expect(columnText(table(), CATEGORY)).toEqual([
      'Amount mismatch',
      'Duplicate settlement',
      'Unmatched ledger transaction',
      'Unmatched settlement',
      'Fee discrepancy',
      'Orphan refund',
      'Split settlement',
      'Wide settlement window',
      'Clean match',
      'Quarantined',
    ]);
  });

  it('puts the quarantined row below the total, carrying no money', () => {
    // Position is the claim: quarantined records are excluded from every figure in the
    // Total row, and sitting underneath it says so more plainly than a label would.
    const { table } = renderCategories();
    const rows = within(table()).getAllByRole('row');
    const totalIndex = rows.indexOf(summaryRows(table())[0]);
    const quarantineIndex = rows.findIndex((r) => within(r).queryByText('Quarantined'));

    expect(quarantineIndex).toBeGreaterThan(totalIndex);

    const quarantine = rows[quarantineIndex];
    const cells = within(quarantine).getAllByRole('cell').map((c) => c.textContent);
    expect(cells[TOTAL_N]).toBe('5'); // the count is real
    expect(cells.slice(SALES)).toEqual(['N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A']);
  });

  it('totals the included categories only', () => {
    const { table } = renderCategories();
    const total = within(summaryRows(table())[0]).getAllByRole('cell').map((c) => c.textContent);

    expect(total[TOTAL_N]).toBe('16');
    expect(total[SALES]).toBe('$6,804.12');
    expect(total[IMPACT]).toBe('−$65.64');
  });

  describe('row routing', () => {
    it('sends the quarantined row to the Quarantine tab', async () => {
      const { table, user, nav } = renderCategories();
      await user.click(within(table()).getByText('Quarantined'));
      expect(nav.toQuarantine).toHaveBeenCalledTimes(1);
    });

    it('sends clean matches to Transactions, since they are not breaks', async () => {
      const { table, user, nav } = renderCategories();
      await user.click(within(table()).getByText('Clean match'));
      expect(nav.toTransactions).toHaveBeenCalledWith({ cats: ['CLEAN_MATCH'] });
      expect(nav.toBreaks).not.toHaveBeenCalled();
    });

    it('sends every break category to Breaks, filtered to it', async () => {
      const { table, user, nav } = renderCategories();
      await user.click(within(table()).getByText('Duplicate settlement'));
      expect(nav.toBreaks).toHaveBeenCalledWith({ catFilter: ['DUPLICATE'], merchantFilter: null });
    });
  });

  it('exports one line per category, masking the excluded row', async () => {
    const { table, user, flash } = renderCategories();

    await exportCsv(table, user);

    const csv = await lastDownload();
    expect(csv.filename).toBe('reconciliation-summary.csv');
    expect(csv.lines).toHaveLength(11); // header + 10 categories
    expect(csv.rows[0].slice(0, 3)).toEqual(['Category', 'Severity', 'Total n']);

    const quarantine = csv.rows.find((r) => r[0] === 'Quarantined');
    expect(quarantine[2]).toBe('5');
    expect(quarantine.slice(5)).toEqual(['N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A']);

    const duplicate = csv.rows.find((r) => r[0] === 'Duplicate settlement');
    expect(duplicate[1]).toBe('high');
    expect(flash).toHaveBeenCalledWith('reconciliation-summary.csv — 10 rows exported');
  });

  it('explains a column on demand without renaming it', async () => {
    // The tooltip is portalled to document.body precisely so it stays out of the
    // header's accessible name — a screen reader must still hear "Discrepancy".
    const { user } = renderCategories();
    const header = screen.getByRole('columnheader', { name: 'Discrepancy' });

    await user.hover(within(header).getByText('Discrepancy'));

    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent(/expected/i);
    expect(tip.closest('body')).toBe(document.body);
    expect(screen.getByRole('columnheader', { name: 'Discrepancy' })).toBe(header);
  });
});
