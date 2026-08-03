// Report with a stubbed `nav`: the tiles, the payout derivation and the tab bar, tested
// for the payloads they hand upward. What those payloads then do to the app is App's
// story, and is covered in src/App.test.jsx.
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Report from './Report.jsx';
import { sampleModel } from '../../test/helpers/model.js';
import { BR_DEFAULTS, TX_DEFAULTS, MR_DEFAULTS } from '../../test/helpers/state.js';
import { navStub } from '../../test/helpers/render.jsx';

const model = sampleModel();

function Harness({ tab, nav, stale, onRun, dismissStale, flash }) {
  const [br, setBr] = useState(BR_DEFAULTS);
  const [tx, setTx] = useState(TX_DEFAULTS);
  const [mr, setMr] = useState(MR_DEFAULTS);
  const [expanded, setExpanded] = useState(null);
  return (
    <Report
      model={model}
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
  );
}

const setup = ({ tab = 'categories', stale = false } = {}) => {
  const nav = navStub();
  const onRun = vi.fn();
  const dismissStale = vi.fn();
  const view = render(
    <Harness tab={tab} nav={nav} stale={stale} onRun={onRun} dismissStale={dismissStale} flash={vi.fn()} />,
  );
  return { ...view, nav, onRun, dismissStale, user: userEvent.setup() };
};

// Both sections are scoped: "Quarantined" and "Total discrepancy" each appear in a tile
// AND further down the page, and the fee-split labels are indented with leading spaces
// that the default text matcher strips from the element but not from the query string.
const tiles = () => screen.getByRole('region', { name: 'Headline figures' });
const payout = () => screen.getByRole('region', { name: 'Payout derivation' });

const tile = (name) => within(tiles()).getByText(name).closest('button, div[style]');
const term = (label) =>
  within(payout())
    .getByText((_, el) => el.tagName === 'SPAN' && el.textContent.trim() === label)
    .closest('div[style*="grid"]');

describe('Report', () => {
  describe('headline tiles', () => {
    it('states the three figures the report is about', () => {
      setup();
      const tiles = screen.getByRole('region', { name: 'Headline figures' });

      expect(within(tiles).getByText('5')).toBeInTheDocument(); // quarantined records
      expect(within(tiles).getByText('−$65.64')).toBeInTheDocument();
      expect(within(tiles).getByText('8')).toBeInTheDocument(); // breaks
      expect(within(tiles).getByText('Processor settled more than expected.')).toBeInTheDocument();
    });

    it('leads with the actionable count and ends with the exclusion note', () => {
      // Order is a decision, not an accident: Breaks is what someone acts on, Quarantined
      // is the caveat about what the report left out. It also decides the reading order of
      // the stack on a narrow viewport, where the tiles sit one above the other.
      setup();
      const labels = [...tiles().children].map((t) => t.textContent);

      expect(labels[0]).toMatch(/^Breaks/);
      expect(labels[1]).toMatch(/^Total discrepancy/);
      expect(labels[2]).toMatch(/^Quarantined/);
    });

    it('routes the two clickable tiles, and leaves the discrepancy inert', async () => {
      // The discrepancy is not a destination: there is no single list behind a net figure.
      const { nav, user } = setup();

      await user.click(tile('Quarantined'));
      expect(nav.toQuarantine).toHaveBeenCalledTimes(1);

      await user.click(tile('Breaks'));
      expect(nav.toBreaks).toHaveBeenCalledTimes(1);

      expect(tile('Total discrepancy').tagName).not.toBe('BUTTON');
    });

    it('stacks into one column on a viewport too narrow for three across', () => {
      // Not cosmetic: nothing on the page is a horizontal scroll container, so a row that
      // stays three-across below its minimum width puts the Breaks tile off the screen
      // entirely, with no way to reach it.
      const wide = window.matchMedia;
      window.matchMedia = (media) => ({ ...wide(media), matches: true });
      try {
        setup();
        expect(tiles()).toHaveStyle({ gridTemplateColumns: '1fr' });
      } finally {
        window.matchMedia = wide;
      }
    });

    it('sits three across on a wide viewport, with no width floor to overrun the page', () => {
      setup();
      expect(tiles()).toHaveStyle({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' });
    });
  });

  describe('payout derivation', () => {
    it('walks gross sales down to the discrepancy', () => {
      setup();

      expect(term('Gross sales')).toHaveTextContent('$6,804.12');
      expect(term('Less gross refunds')).toHaveTextContent('−$1,557.02');
      expect(term('Less total fees')).toHaveTextContent('−$151.74');
      expect(term('Expected payout')).toHaveTextContent('$5,095.36');
      expect(term('Actual settled')).toHaveTextContent('$5,161.00');
      expect(term('Total discrepancy')).toHaveTextContent('−$65.64');
    });

    it('splits the fee line into its two components on demand', async () => {
      const { user } = setup();

      expect(within(payout()).queryByText('Interchange fees')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'show split' }));

      expect(term('Interchange fees')).toHaveTextContent('−$130.48');
      expect(term('Processor fees')).toHaveTextContent('−$21.26');
      expect(screen.getByRole('button', { name: 'hide split' })).toBeInTheDocument();
    });

    it('opens each figure on the rows behind it', async () => {
      const { nav, user } = setup();

      await user.click(within(term('Gross sales')).getByText('$6,804.12'));
      expect(nav.toTransactions).toHaveBeenCalledWith({ type: 'SALE', sortKey: 'sales' });

      // Refunds ascend: their amounts are negative, so ascending puts the largest first.
      await user.click(within(term('Less gross refunds')).getByText('−$1,557.02'));
      expect(nav.toTransactions).toHaveBeenCalledWith({ type: 'REFUND', sortKey: 'refunds', sortDir: 'asc' });

      await user.click(within(term('Actual settled')).getByText('$5,161.00'));
      expect(nav.toTransactions).toHaveBeenCalledWith({ view: 'settlement', sortKey: 'settled' });

      await user.click(within(term('Total discrepancy')).getByText('−$65.64'));
      expect(nav.toBreaks).toHaveBeenCalledTimes(1);
    });

    it('sends the fee components to the settlement view, where fees are itemised', async () => {
      const { nav, user } = setup();

      await user.click(screen.getByRole('button', { name: 'show split' }));
      await user.click(within(term('Interchange fees')).getByText('−$130.48'));

      expect(nav.toTransactions).toHaveBeenCalledWith({ view: 'settlement', sortKey: 'fees' });
    });
  });

  describe('tab bar', () => {
    it('counts each section', () => {
      setup();
      const tabs = screen.getByRole('navigation', { name: 'Report sections' });

      expect(within(tabs).getByText('Summary')).toBeInTheDocument();
      expect(within(tabs).getByText('Merchants · 8')).toBeInTheDocument();
      expect(within(tabs).getByText('Breaks · 8')).toBeInTheDocument();
      expect(within(tabs).getByText('Transactions · 15/17')).toBeInTheDocument();
      expect(within(tabs).getByText('Quarantine · 5')).toBeInTheDocument();
    });

    it('asks the parent to switch tabs', async () => {
      const { nav, user } = setup();
      await user.click(screen.getByText('Breaks · 8'));
      expect(nav.goTab).toHaveBeenCalledWith('breaks');
    });

    it.each([
      ['categories', 'Reconciliation Summary'],
      ['merchants', 'Merchant rollup'],
      ['breaks', 'Breaks'],
      ['transactions', 'Transactions by ledger transaction'],
      ['quarantine', 'Quarantined Records'],
    ])('mounts only the %s table', (tab, label) => {
      setup({ tab });
      expect(screen.getByRole('table', { name: label })).toBeInTheDocument();
      expect(screen.getAllByRole('table')).toHaveLength(1);
    });
  });

  describe('stale banner', () => {
    it('offers a re-run and a dismissal once data was imported', async () => {
      const { onRun, dismissStale, user } = setup({ stale: true });
      const banner = screen.getByRole('status');

      expect(banner).toHaveTextContent('You have imported data since the last reconciliation.');

      await user.click(within(banner).getByRole('button', { name: 'Run reconciliation' }));
      expect(onRun).toHaveBeenCalledTimes(1);

      // Scoped: ImportZone renders another control labelled "Dismiss" in the full app.
      await user.click(within(banner).getByLabelText('Dismiss'));
      expect(dismissStale).toHaveBeenCalledTimes(1);
    });

    it('stays out of the way when the report is current', () => {
      setup({ stale: false });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
