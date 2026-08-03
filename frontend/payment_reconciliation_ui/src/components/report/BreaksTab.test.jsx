import { describe, it, expect } from 'vitest';
import { renderBreaks, dataRows, summaryRows, columnText, screen, within } from '../../test/helpers/render.jsx';
import { lastDownload } from '../../test/helpers/downloads.js';
import { sampleModel, largeModel, withoutCategory, quarantineOnlyPayload } from '../../test/helpers/model.js';
import { normalize } from '../../domain/normalize.js';

// Column order: Category, Merchant, Merchant ref, Sales, Refunds, Fees, Exp pay, Settled,
// Discrepancy, Captured on, Settled on.
const CATEGORY = 0;
const MERCHANT = 1;

// Sorting appends " ↓"/" ↑" to a header's accessible name, and several labels are
// prefixes of each other (Merchant / Merchant ref, Settled / Settled on) — so the match
// has to allow the arrow and nothing else. SortHeader is itself the button, so the
// element this returns is directly clickable.
const header = (label) => screen.getByRole('columnheader', { name: new RegExp(`^${label}( [↑↓])?$`) });

const search = () => screen.getByPlaceholderText(/Search id, merchant, ref, amount, or date/);

/** The footer line, which splits its count and sort note across elements. */
const footer = () => screen.getByText(/breaks · sorted by/).closest('div');

/** Discrepancy magnitudes down the body rows, the figure the default sort orders on. */
const magnitudes = (table) =>
  columnText(table(), 8).map((v) => Math.abs(Number(v.replace(/[^0-9.]/g, ''))));

/** Row identity is only visible through the subline's copy buttons, so read those. */
const rowKeys = (table) =>
  dataRows(table()).map((r) => r.parentElement.querySelector('button')?.textContent ?? '');

describe('BreaksTab', () => {
  it('opens on every break, largest discrepancy first', () => {
    const { table } = renderBreaks();

    expect(dataRows(table())).toHaveLength(8);
    expect(columnText(table(), CATEGORY)).toEqual([
      'Duplicate settlement',
      'Unmatched ledger transaction',
      'Unmatched settlement',
      'Amount mismatch',
      'Fee discrepancy',
      'Orphan refund',
      'Wide settlement window',
      'Split settlement',
    ]);
    expect(footer()).toHaveTextContent('8 of 8 breaks · sorted by absolute discrepancy, then severity ↓ descending');
    expect(screen.getByText('/report/breaks')).toBeInTheDocument();
  });

  describe('sorting', () => {
    it('flips direction on a second click of the same header', async () => {
      const { table, user } = renderBreaks();

      expect(header('Discrepancy')).toHaveAttribute('aria-sort', 'descending');
      expect(magnitudes(table)).toEqual([...magnitudes(table)].sort((a, b) => b - a));

      await user.click(header('Discrepancy'));

      expect(header('Discrepancy')).toHaveAttribute('aria-sort', 'ascending');
      // Not simply the reverse of the descending order: five breaks tie at $0.00 and
      // break that tie on severity, which does not flip with the direction.
      expect(magnitudes(table)).toEqual([...magnitudes(table)].sort((a, b) => a - b));
    });

    it('hands the sort to a new column at that column-s natural direction', async () => {
      const { table, user } = renderBreaks();

      await user.click(header('Merchant'));

      expect(header('Merchant')).toHaveAttribute('aria-sort', 'ascending');
      expect(header('Discrepancy')).toHaveAttribute('aria-sort', 'none');
      expect(columnText(table(), MERCHANT)).toEqual([...columnText(table(), MERCHANT)].sort());
    });

    // Each column has its own comparator, and an unexercised one is invisible until a
    // user sorts by it. Sorting by every column keeps the whole set honest.
    it.each([
      'Category',
      'Merchant',
      'Merchant ref',
      'Sales',
      'Refunds',
      'Fees',
      'Exp pay',
      'Settled',
      'Discrepancy',
      'Captured on',
      'Settled on',
    ])('sorts by %s without dropping or duplicating a row', async (label) => {
      const { table, user } = renderBreaks();

      await user.click(header(label));

      expect(header(label).getAttribute('aria-sort')).toMatch(/ascending|descending/);
      expect(dataRows(table())).toHaveLength(8);
      expect(new Set(rowKeys(table)).size).toBe(8);
    });

    // The rule at BreaksTab.jsx:77-93: a row missing the sorted value sinks to the bottom
    // in BOTH directions, so a direction flip never promotes an absence to the top.
    describe('rows missing the sorted value always sink', () => {
      const sinksBothWays = async (label, expectedLast) => {
        const { table, user } = renderBreaks();
        const click = () => user.click(header(label));

        await click();
        expect(rowKeys(table).slice(-expectedLast.length).sort()).toEqual([...expectedLast].sort());
        await click();
        expect(rowKeys(table).slice(-expectedLast.length).sort()).toEqual([...expectedLast].sort());
      };

      it('sinks the never-settled break under Settled', async () => {
        await sinksBothWays('Settled', ['TXN-000009']);
      });

      it('sinks the never-settled break under Fees', async () => {
        await sinksBothWays('Fees', ['TXN-000009']);
      });

      it('sinks the ledger-less break under Captured on', async () => {
        // The unmatched settlement has no ledger row, so it has no capture date.
        await sinksBothWays('Captured on', ['no ledger id']);
      });

      it('sinks both sale-less breaks under Sales', async () => {
        // An orphan refund and an unattributed settlement each populate refunds, not sales.
        await sinksBothWays('Sales', ['TXN-000013', 'no ledger id']);
      });

      it('sinks nothing under Exp pay, which every row defines', async () => {
        const { table, user } = renderBreaks();
        await user.click(header('Exp pay'));
        const ascending = rowKeys(table);

        await user.click(header('Exp pay'));
        expect(rowKeys(table)).toEqual([...ascending].reverse());
      });
    });
  });

  describe('category filter', () => {
    it('counts each category, narrows to the ticked ones and names them in the strip', async () => {
      const { table, user } = renderBreaks();
      const trigger = screen.getByRole('button', { name: /All categories/ });

      await user.click(trigger);
      expect(screen.getByRole('checkbox', { name: /Duplicate settlement/ })).toBeInTheDocument();

      await user.click(screen.getByRole('checkbox', { name: /Duplicate settlement/ }));
      await user.click(screen.getByRole('checkbox', { name: /Split settlement/ }));

      expect(screen.getByRole('button', { name: /2 categories/ })).toBeInTheDocument();
      expect(dataRows(table())).toHaveLength(2);
      expect(screen.getByText(/category: Duplicate settlement, Split settlement/)).toBeInTheDocument();
    });

    it('clears the selection without closing, and closes on Done', async () => {
      const { table, user } = renderBreaks({ br: { catFilter: ['DUPLICATE'], catOpen: true } });

      await user.click(screen.getByRole('button', { name: 'Clear' }));
      expect(dataRows(table())).toHaveLength(8);
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Done' }));
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    it('offers a category this dataset never produced, at zero', async () => {
      // The menu is the vocabulary of break categories, not a projection of the data —
      // a control that offers nothing cannot say whether the data is clean or the
      // control is broken.
      const { table, user } = renderBreaks({ model: withoutCategory(sampleModel(), 'WIDE_WINDOW') });

      await user.click(screen.getByRole('button', { name: /All categories/ }));
      const wide = screen.getByRole('checkbox', { name: /Wide settlement window/ });
      expect(wide.closest('label')).toHaveTextContent(/Wide settlement window\s*0/);

      await user.click(wide);
      expect(dataRows(table())).toHaveLength(0);
      expect(screen.getByText('No breaks match these filters.')).toBeInTheDocument();
      expect(screen.getByText(/category: Wide settlement window/)).toBeInTheDocument();
    });

    it('stays populated when nothing reconciled at all', async () => {
      // The case that prompted this: one quarantined record and nothing else. Breaks are
      // empty, so a data-derived menu would offer nothing at all.
      const { user } = renderBreaks({ model: normalize(quarantineOnlyPayload()) });

      await user.click(screen.getByRole('button', { name: /All categories/ }));

      expect(screen.getAllByRole('checkbox')).toHaveLength(8); // every break category
      // Neither of the two non-break categories belongs on this tab.
      expect(screen.queryByRole('checkbox', { name: /Clean match/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: /Quarantined/ })).not.toBeInTheDocument();
    });
  });

  describe('search', () => {
    it('matches an id', async () => {
      const { table, user } = renderBreaks();
      await user.type(search(), 'TXN-000012');
      expect(dataRows(table())).toHaveLength(1);
    });

    it('matches a merchant across its breaks', async () => {
      const { table, user } = renderBreaks();
      await user.type(search(), 'MERCH-004');
      expect(dataRows(table())).toHaveLength(3);
      expect(new Set(columnText(table(), MERCHANT))).toEqual(new Set(['MERCH-004']));
    });

    it('matches a qualified date range', async () => {
      const { table, user } = renderBreaks();
      await user.type(search(), 'captured:2026-06-01..2026-06-03');

      const rows = dataRows(table());
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        const captured = within(row).getAllByRole('cell')[9].textContent;
        expect(captured >= '2026-06-01' && captured <= '2026-06-03').toBe(true);
      }
    });

    it('drops the Total row entirely when nothing matches', async () => {
      // A total over zero rows would be a row of zeroes pretending to be a summary.
      const { table, user } = renderBreaks();

      await user.type(search(), 'nothing-matches-this');
      expect(dataRows(table())).toHaveLength(0);
      expect(summaryRows(table())).toHaveLength(0);
      expect(screen.getByText('No breaks match these filters.')).toBeInTheDocument();
    });
  });

  it('re-totals and re-counts over the filtered rows', async () => {
    const { table, user } = renderBreaks();

    await user.type(search(), 'MERCH-004');

    expect(within(summaryRows(table())[0]).getAllByRole('cell')[0]).toHaveTextContent('Total — 3 of 8 breaks');
    expect(screen.getByText(/3 of 8 breaks · sorted by/)).toBeInTheDocument();
  });

  it('clears every filter but leaves the sort alone', async () => {
    // The documented contract of FilterStrip: it resets filters, never the sort or view.
    const { table, user, box } = renderBreaks({ br: { catFilter: ['DUPLICATE'], merchantFilter: 'MERCH-008' } });

    await user.type(search(), 'TXN');
    await user.click(header('Merchant'));
    expect(box.state).toMatchObject({ sortKey: 'merchant', sortDir: 'asc' });

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(box.state).toMatchObject({
      query: '',
      catFilter: [],
      merchantFilter: null,
      sortKey: 'merchant',
      sortDir: 'asc',
    });
    expect(dataRows(table())).toHaveLength(8);
  });

  describe('row expansion', () => {
    it('opens one row at a time', async () => {
      const { table, user, box } = renderBreaks();

      await user.click(dataRows(table())[0]);
      expect(box.expanded).toBe('TXN-000012');
      expect(dataRows(table())[0]).toHaveAttribute('aria-expanded', 'true');

      await user.click(dataRows(table())[1]);
      expect(box.expanded).toBe('TXN-000009');
      expect(dataRows(table()).filter((r) => r.getAttribute('aria-expanded') === 'true')).toHaveLength(1);
    });

    it('copies an id without toggling the row it sits under', async () => {
      const { table, user, flash, box } = renderBreaks();
      const copy = dataRows(table())[0].parentElement.querySelector('button');

      await user.click(copy);

      expect(flash).toHaveBeenCalledWith('Internal txn id copied');
      expect(box.expanded).toBeNull();
    });

    it('copies the network ref from the same subline', async () => {
      const { table, user, flash, box } = renderBreaks();
      const buttons = dataRows(table())[0].parentElement.querySelectorAll('button');

      await user.click(buttons[buttons.length - 1]);

      expect(flash).toHaveBeenCalledWith('Network ref copied');
      expect(box.expanded).toBeNull();
    });
  });

  it('offers the search grammar from the toolbar', async () => {
    const { user } = renderBreaks();

    await user.click(screen.getByRole('button', { name: '?' }));
    expect(screen.getByText('2026-06-01..2026-06-05')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('2026-06-01..2026-06-05')).not.toBeInTheDocument();
  });

  describe('CSV export', () => {
    const exportCsv = (user) => user.click(screen.getByRole('button', { name: 'Export CSV' }));

    it('writes one line per settlement and says so when the two counts differ', async () => {
      const { user, flash } = renderBreaks();

      await exportCsv(user);

      const csv = await lastDownload();
      expect(csv.filename).toBe('breaks.csv');
      // 8 breaks, but the duplicate and the split each settled in two parts.
      expect(csv.lines).toHaveLength(11);
      expect(flash).toHaveBeenCalledWith('breaks.csv — 8 breaks over 10 rows');
    });

    it('blanks the ledger-side figures on every part after the first', async () => {
      // Repeating a transaction's sale on each of its parts would double it in any
      // spreadsheet that sums the column.
      const { user } = renderBreaks();

      await exportCsv(user);

      const csv = await lastDownload();
      const part = csv.rows[0].indexOf('Part');
      const sales = csv.rows[0].indexOf('Sales');
      const parts = csv.rows.filter((r) => r[part] === '1/2' || r[part] === '2/2');

      expect(parts).toHaveLength(4); // two breaks × two parts
      for (const row of parts.filter((r) => r[part] === '2/2')) {
        expect(row[sales]).toBe('');
      }
      expect(parts.filter((r) => r[part] === '1/2').every((r) => r[sales] !== '')).toBe(true);
    });

    it('counts plainly when every break is a single row', async () => {
      const { user, flash } = renderBreaks();

      await user.type(search(), 'TXN-000005');
      await exportCsv(user);

      expect(flash).toHaveBeenCalledWith('breaks.csv — 1 rows');
    });
  });
  // The paths that only engage past WINDOW_MIN rows. jsdom performs no layout, so the row
  // metrics stay at their estimates — which is the guard being relied on here, and enough
  // to exercise the geometry.
  describe('at scale', () => {
    // Built once: `normalize` is pure and no component mutates the model.
    const big = largeModel(2000);
    const breakCount = big.included.filter((r) => r.category !== 'CLEAN_MATCH').length;

    it('renders a window onto the breaks, not all of them', () => {
      const { table } = renderBreaks({ model: big });

      expect(breakCount).toBeGreaterThan(120); // past the windowing threshold
      expect(dataRows(table()).length).toBeLessThan(120);
      expect(footer()).toHaveTextContent(`${breakCount} of ${breakCount} breaks`);
    });

    it('tells assistive tech how long the table really is', () => {
      const { table } = renderBreaks({ model: big });
      expect(table()).toHaveAttribute('aria-rowcount', String(breakCount + 1));
    });

    it('sizes its columns off the data, so the total row cannot clip', () => {
      const { table } = renderBreaks({ model: big });
      const cells = within(summaryRows(table())[0]).getAllByRole('cell');
      // Label, then the six money columns — each a whole figure, not a truncation.
      expect(cells[0].textContent).toBe('Total');
      expect(cells[1].textContent).toMatch(/^\$[\d,]+\.\d\d$/);
      expect(cells.at(-1).textContent).toMatch(/^[+−]\$[\d,]+\.\d\d$/);
    });

    it('exports every filtered break, not the rendered window', async () => {
      const { user, flash } = renderBreaks({ model: big });
      await user.click(screen.getByRole('button', { name: 'Export CSV' }));

      const csv = await lastDownload();
      expect(csv.lines.length).toBeGreaterThan(breakCount); // header + >= one line per break
      expect(flash).toHaveBeenCalledWith(expect.stringContaining(`${breakCount} breaks over`));
    });
  });
});
