import { describe, it, expect } from 'vitest';
import { renderMerchants, dataRows, summaryRows, columnText, screen, within } from '../../test/helpers/render.jsx';
import { lastDownload } from '../../test/helpers/downloads.js';
import { largeModel } from '../../test/helpers/model.js';

// Column order: Merchant, Sales, Refunds, Interchange, Processor, Fees, Exp pay, Settled,
// Discrepancy, Clean, Breaks, Quarantine.
const MERCHANT = 0;
const SALES = 1;
const QUARANTINE = 11;

const search = () => screen.getByPlaceholderText(/Search merchant or amount/);
const totalLabel = (table) => within(summaryRows(table())[0]).getAllByRole('cell')[0].textContent;

describe('MerchantTable', () => {
  it('rolls every merchant up, breaks first', () => {
    const { table } = renderMerchants();

    expect(dataRows(table())).toHaveLength(8);
    expect(columnText(table(), MERCHANT)).toEqual([
      'MERCH-008',
      'MERCH-002',
      'MERCH-004',
      'MERCH-006',
      'MERCH-001',
      'MERCH-005',
      'MERCH-007',
      'MERCH-003',
    ]);
    expect(totalLabel(table)).toBe('Total');
  });

  it('reads N/A across the money columns for a wholly quarantined merchant', () => {
    // MERCH-003's only record is quarantined, so it contributes to nothing but its own
    // count — the footer note this table carries.
    const { table } = renderMerchants();
    const row = dataRows(table()).find((r) => within(r).queryByText('MERCH-003'));
    const cells = within(row).getAllByRole('cell').map((c) => c.textContent);

    expect(cells.slice(SALES, QUARANTINE)).toEqual(['N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A']);
    expect(cells[QUARANTINE]).toBe('1');
  });

  describe('breaks-only filter', () => {
    it('drops every merchant without a break and re-totals over what is left', async () => {
      const { table, user } = renderMerchants();

      await user.click(screen.getByRole('button', { name: 'Breaks only' }));

      expect(columnText(table(), MERCHANT)).toEqual(['MERCH-008', 'MERCH-002', 'MERCH-004', 'MERCH-006']);
      expect(totalLabel(table)).toBe('Total — 4 of 8 merchants');
      expect(screen.getByText(/show: Breaks only/)).toBeInTheDocument();
    });

    it('restores the full roster', async () => {
      const { table, user } = renderMerchants({ mr: { breaksOnly: true } });

      await user.click(screen.getByRole('button', { name: 'All' }));
      expect(dataRows(table())).toHaveLength(8);
      expect(screen.queryByText(/show: Breaks only/)).not.toBeInTheDocument();
    });
  });

  describe('search', () => {
    it('narrows to a merchant id', async () => {
      const { table, user } = renderMerchants();

      await user.type(search(), 'MERCH-004');
      expect(columnText(table(), MERCHANT)).toEqual(['MERCH-004']);
      expect(screen.getByText(/search: "MERCH-004"/)).toBeInTheDocument();
    });

    it('matches an amount in any money column', async () => {
      const { table, user } = renderMerchants();
      const anySales = columnText(table(), SALES).find((v) => v !== 'N/A' && v !== '$0.00');

      await user.type(search(), anySales.replace(/[$,]/g, ''));
      expect(dataRows(table()).length).toBeGreaterThan(0);
      expect(dataRows(table()).length).toBeLessThan(8);
    });

    it('keeps the Total row when nothing matches', async () => {
      // Unlike Breaks, this table always prints its Total — an empty one still reads as a
      // true statement about the filtered set.
      const { table, user } = renderMerchants();

      await user.type(search(), 'MERCH-NOPE');
      expect(dataRows(table())).toHaveLength(0);
      expect(summaryRows(table())).toHaveLength(1);
      expect(totalLabel(table)).toBe('Total — 0 of 8 merchants');
    });
  });

  it('clears both filters at once, and only the filters', async () => {
    const { table, user, box } = renderMerchants();

    await user.click(screen.getByRole('button', { name: 'Breaks only' }));
    await user.type(search(), 'MERCH-004');
    expect(dataRows(table())).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(box.state).toMatchObject({ query: '', breaksOnly: false });
    expect(dataRows(table())).toHaveLength(8);
  });

  describe('row routing', () => {
    it('sends a wholly quarantined merchant to the Quarantine tab', async () => {
      const { table, user, nav } = renderMerchants();
      await user.click(within(table()).getByText('MERCH-003'));
      expect(nav.toQuarantine).toHaveBeenCalledTimes(1);
    });

    it('sends a merchant with breaks to its filtered break list', async () => {
      const { table, user, nav } = renderMerchants();
      await user.click(within(table()).getByText('MERCH-004'));
      expect(nav.toBreaks).toHaveBeenCalledWith({ merchantFilter: 'MERCH-004', catFilter: [] });
    });

    it('sends a clean merchant to Transactions, where its rows actually are', async () => {
      // MERCH-005 has included rows but no breaks: routing it to Breaks would land on an
      // empty list.
      const { table, user, nav } = renderMerchants();
      await user.click(within(table()).getByText('MERCH-005'));
      expect(nav.toTransactions).toHaveBeenCalledWith({ query: 'merchant:MERCH-005' });
      expect(nav.toBreaks).not.toHaveBeenCalled();
    });
  });

  it('exports the visible rows, with deductions signed negative', async () => {
    const { table, user, flash } = renderMerchants();

    await user.click(within(table().closest('section')).getByRole('button', { name: 'Export CSV' }));

    const csv = await lastDownload();
    expect(csv.filename).toBe('merchant-rollup.csv');
    expect(csv.lines).toHaveLength(9); // header + 8 merchants
    expect(csv.rows[0][0]).toBe('Merchant');

    const quarantineOnly = csv.rows.find((r) => r[0] === 'MERCH-003');
    expect(quarantineOnly.slice(1, -1).every((v) => v === 'N/A')).toBe(true);
    expect(quarantineOnly.at(-1)).toBe('1');

    // Refunds/fees are deductions, so they export negative rather than as bare magnitudes.
    const refundsCol = csv.rows[0].indexOf('Refunds');
    const withRefund = csv.rows.slice(1).find((r) => r[refundsCol] !== 'N/A' && r[refundsCol] !== '0.00');
    expect(withRefund[refundsCol]).toMatch(/^-\d/);

    expect(flash).toHaveBeenCalledWith('merchant-rollup.csv — 8 rows exported');
  });

  it('exports only what the filter left on screen', async () => {
    const { table, user, flash } = renderMerchants({ mr: { breaksOnly: true } });

    await user.click(within(table().closest('section')).getByRole('button', { name: 'Export CSV' }));

    const csv = await lastDownload();
    expect(csv.lines).toHaveLength(5); // header + 4 merchants with breaks
    expect(flash).toHaveBeenCalledWith('merchant-rollup.csv — 4 rows exported');
  });
  // The paths that only engage past WINDOW_MIN rows. jsdom performs no layout, so the row
  // metrics stay at their estimates — which is the guard being relied on here, and enough
  // to exercise the geometry.
  describe('at scale', () => {
    const MERCHANTS = 600;
    // Built once: `normalize` is pure and no component mutates the model.
    const big = largeModel(2400, { merchants: MERCHANTS, quarantined: 40 });

    it('renders a window onto the merchants, not all of them', () => {
      const { table } = renderMerchants({ model: big });

      expect(dataRows(table()).length).toBeLessThan(120);
      expect(totalLabel(table)).toBe('Total');
    });

    it('tells assistive tech how long the table really is', () => {
      const { table } = renderMerchants({ model: big });
      expect(table()).toHaveAttribute('aria-rowcount', String(MERCHANTS + 1));
    });

    it('sizes its columns off the data, so the total row cannot clip', () => {
      const { table } = renderMerchants({ model: big });
      const cells = within(summaryRows(table())[0]).getAllByRole('cell');
      expect(cells[SALES].textContent).toMatch(/^\$[\d,]+\.\d\d$/);
    });

    it('filters and totals over every merchant, not the rendered window', async () => {
      const { table, user } = renderMerchants({ model: big });
      const before = within(summaryRows(table())[0]).getAllByRole('cell')[SALES].textContent;

      await user.type(search(), 'MERCH-0001');
      expect(totalLabel(table)).toMatch(/^Total — 1 of 600 merchants$/);
      expect(within(summaryRows(table())[0]).getAllByRole('cell')[SALES].textContent).not.toBe(before);
    });

    it('exports every merchant, not the rendered window', async () => {
      const { user, flash } = renderMerchants({ model: big });
      await user.click(screen.getByRole('button', { name: 'Export CSV' }));

      const csv = await lastDownload();
      expect(csv.lines).toHaveLength(MERCHANTS + 1); // header + every merchant
      expect(flash).toHaveBeenCalledWith(`merchant-rollup.csv — ${MERCHANTS} rows exported`);
    });
  });
});
