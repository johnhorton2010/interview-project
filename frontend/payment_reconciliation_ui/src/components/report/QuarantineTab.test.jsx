import { describe, it, expect } from 'vitest';
import { normalize } from '../../domain/normalize.js';
import { emptyPayload, largeModel } from '../../test/helpers/model.js';
import { renderQuarantine, dataRows, columnText, screen, within } from '../../test/helpers/render.jsx';
import { lastDownload } from '../../test/helpers/downloads.js';

// Column order: Side, Identifier, Merchant, Amount, Why it was withheld.
const SIDE = 0;
const ID = 1;
const AMOUNT = 3;
const REASON = 4;

describe('QuarantineTab', () => {
  it('lists every withheld record, ledger side first', () => {
    const { table } = renderQuarantine();

    expect(dataRows(table())).toHaveLength(5);
    // Rendered in title case and uppercased by CSS, so the text content is 'Ledger'.
    expect(columnText(table(), SIDE)).toEqual(['Ledger', 'Ledger', 'Ledger', 'Settlement', 'Settlement']);
    expect(columnText(table(), ID)).toEqual([
      'TXN-BAD-003',
      'TXN-BAD-001',
      'TXN-BAD-002',
      'ARNBAD0000000000001',
      'ARNBAD0000000000002',
    ]);
  });

  it('states why each record was withheld', () => {
    const { table } = renderQuarantine();
    expect(columnText(table(), REASON)).toEqual([
      'Currency EUR — non-USD records are always quarantined.',
      'Missing card type — required field absent.',
      'Gross amount not a parseable number.',
      'Settled amount omitted by the processor.',
      'Currency EUR — non-USD records are always quarantined.',
    ]);
  });

  it('distinguishes an absent amount from a zero one', () => {
    // The footer legend exists to name this pair, so the table must actually draw both.
    const { table } = renderQuarantine();
    const amounts = columnText(table(), AMOUNT);

    expect(amounts[2]).toBe('—'); // TXN-BAD-002, gross unparseable
    expect(amounts[3]).toBe('—'); // ARNBAD…0001, settled omitted
    expect(amounts[0]).toBe('$120.00');
    // The footer legend names both glyphs, which is why the table may use either.
    const legend = screen.getByText(/withheld for a zero-value amount|\$0\.00/).closest('div');
    expect(legend).toHaveTextContent('$0.00');
  });

  it('expands a row into its detail and collapses it again', async () => {
    const { table, user } = renderQuarantine();
    const row = () => dataRows(table())[0];

    expect(row()).toHaveAttribute('aria-expanded', 'false');

    await user.click(row());
    expect(row()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Quarantined record')).toBeInTheDocument();

    await user.click(row());
    expect(row()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Quarantined record')).not.toBeInTheDocument();
  });

  it('keys expansion by side, so only the clicked row opens', async () => {
    // Keys are `q:ledger:…` / `q:settle:…` because `expanded` is shared with the Breaks
    // and Transactions tabs, where a bare id could collide.
    const { table, user, box } = renderQuarantine();

    await user.click(dataRows(table())[0]);
    expect(box.expanded).toBe('q:ledger:TXN-BAD-003');

    await user.click(dataRows(table())[3]);
    expect(box.expanded).toBe('q:settle:ARNBAD0000000000001');
    expect(dataRows(table()).filter((r) => r.getAttribute('aria-expanded') === 'true')).toHaveLength(1);
  });

  it('exports every withheld record with its reason', async () => {
    const { table, user, flash } = renderQuarantine();

    await user.click(within(table().closest('section')).getByRole('button', { name: 'Export CSV' }));

    const csv = await lastDownload();
    expect(csv.filename).toBe('quarantined-records.csv');
    expect(csv.rows[0]).toEqual(['Side', 'Identifier', 'Merchant', 'Amount', 'Reason']);
    expect(csv.lines).toHaveLength(6); // header + 5 records
    expect(csv.rows[1]).toEqual([
      'Ledger',
      'TXN-BAD-003',
      'MERCH-007',
      '120.00',
      'Currency EUR — non-USD records are always quarantined.',
    ]);
    // An absent amount exports empty rather than as a zero.
    expect(csv.rows[3][3]).toBe('');
    expect(flash).toHaveBeenCalledWith('quarantined-records.csv — 5 rows exported');
  });

  it('says so when nothing was withheld', () => {
    const { table } = renderQuarantine({ model: normalize(emptyPayload()) });

    expect(dataRows(table())).toHaveLength(0);
    expect(screen.getByText('Nothing quarantined.')).toBeInTheDocument();
  });
  // The paths that only engage past WINDOW_MIN rows. jsdom performs no layout, so the row
  // metrics stay at their estimates — which is the guard being relied on here, and enough
  // to exercise the geometry.
  describe('at scale', () => {
    const PER_SIDE = 400;
    // Built once: `normalize` is pure and no component mutates the model.
    const big = largeModel(200, { quarantined: PER_SIDE });
    const total = PER_SIDE * 2; // one withheld record per side, per iteration

    it('renders a window onto the withheld records, not all of them', () => {
      const { table } = renderQuarantine({ model: big });
      expect(dataRows(table()).length).toBeLessThan(120);
    });

    it('tells assistive tech how long the table really is', () => {
      const { table } = renderQuarantine({ model: big });
      expect(table()).toHaveAttribute('aria-rowcount', String(total + 1));
    });

    it('sizes the reason column from its whole vocabulary, not the rows on screen', () => {
      // Every `quarantineReason` branch is represented in the fixture, and only a few of
      // them are within the first window — so a column sized off the rendered rows would
      // be too narrow for the reasons further down.
      const { table } = renderQuarantine({ model: big });
      const shown = new Set(columnText(table(), REASON));
      expect(shown.size).toBeGreaterThan(1);
      // The track is wide enough for the longest reason in the whole set, not just these.
      const track = table().querySelector('[role="row"]').style.gridTemplateColumns.split(' ')[REASON];
      expect(parseFloat(track)).toBeGreaterThan(200); // clears the spec floor
    });

    it('exports every withheld record, not the rendered window', async () => {
      const { user, flash } = renderQuarantine({ model: big });
      await user.click(screen.getByRole('button', { name: 'Export CSV' }));

      const csv = await lastDownload();
      expect(csv.lines).toHaveLength(total + 1); // header + every record
      expect(flash).toHaveBeenCalledWith(`quarantined-records.csv — ${total} rows exported`);
    });
  });
});
