// BreakDetail and the panel primitives underneath it, driven by real rows from the golden
// fixture so the arithmetic on screen is the arithmetic the domain layer computed.
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BreakDetail from './BreakDetail.jsx';
import { sampleModel } from '../test/helpers/model.js';

const model = sampleModel();
const row = (id) => model.rows.find((r) => r.id === id);

const setup = (id) => ({ ...render(<BreakDetail row={row(id)} model={model} />), user: userEvent.setup() });

/** The centre column's arithmetic box, scoped so its labels cannot collide with the
 *  identically-named field rows in the processor panel beside it. */
const mathBox = () => screen.getByText('Impact on discrepancy').parentElement.parentElement;
const math = (label) => within(mathBox()).getByText(label).parentElement;

/** One of the bordered record cards, addressed by its heading. */
const panel = (title) => screen.getAllByText(title)[0].closest('div').parentElement;

describe('BreakDetail', () => {
  describe('a two-sided break', () => {
    it('shows both sides with the ledger identity', () => {
      setup('TXN-000005');

      expect(screen.getByText('Ledger side')).toBeInTheDocument();
      expect(screen.getByText('Processor side')).toBeInTheDocument();
      expect(within(panel('Ledger side')).getByText('TXN-000005')).toBeInTheDocument();
      // The same card is stated on both sides — that agreement is the point of the pair.
      expect(within(panel('Ledger side')).getByText('VISA ····3003')).toBeInTheDocument();
      expect(within(panel('Processor side')).getByText('VISA ····3003')).toBeInTheDocument();
    });

    it('names the category and explains it', () => {
      setup('TXN-000005');

      expect(screen.getByText('Amount mismatch')).toBeInTheDocument();
      expect(screen.getByText(/Settled amount differs from the ledger amount net of fees/)).toBeInTheDocument();
    });

    it('walks the arithmetic down to this row-s impact', () => {
      setup('TXN-000005');

      expect(math('Ledger amount')).toHaveTextContent('+$757.81');
      expect(math('Less fees')).toHaveTextContent('−$16.06');
      expect(math('Expected')).toHaveTextContent('$741.75');
      expect(math('Settled amount')).toHaveTextContent('$738.25');
      expect(math('Impact on discrepancy')).toHaveTextContent('+$3.50');
    });

    it('rings the field the category is about', () => {
      // The mismatch is in the amount, so that is the field the detail highlights.
      setup('TXN-000005');
      const gross = within(panel('Ledger side')).getByText('Gross amount').parentElement;
      expect(gross).toHaveTextContent('$757.81');
    });
  });

  describe('one-sided breaks', () => {
    it('says the processor never settled a recorded sale', () => {
      setup('TXN-000009');

      expect(screen.getByText('No settlement received')).toBeInTheDocument();
      expect(screen.getByText('We recorded a sale the processor never settled.')).toBeInTheDocument();
      expect(screen.getByText('Ledger side')).toBeInTheDocument();
    });

    it('says the ledger is missing a transaction the processor settled', () => {
      setup('ARN74000000000000058801');

      expect(screen.getByText('No ledger transaction')).toBeInTheDocument();
      expect(screen.getByText('The processor settled something absent from our ledger.')).toBeInTheDocument();
      expect(screen.getByText('Processor side')).toBeInTheDocument();
    });
  });

  it('renders one processor card per payout of a split settlement', () => {
    setup('TXN-000015');

    expect(screen.getAllByText('Processor side')).toHaveLength(2);
    expect(screen.getByText('Split settlement')).toBeInTheDocument();
  });

  describe('related transactions', () => {
    it('reveals and hides the related panels on demand', async () => {
      // TXN-000002 and TXN-000003 share a merchant ref, so each lists the other.
      const { user } = setup('TXN-000002');
      const toggle = () => screen.getByRole('button', { name: /Show panels|Hide panels/ });

      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('TXN-000003')).toBeInTheDocument(); // listed, not expanded

      await user.click(toggle());

      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(toggle()).toHaveTextContent('Hide panels');
      // Expanding adds a panel on each side, so the related id now appears more than once.
      expect(screen.getAllByText('TXN-000003').length).toBeGreaterThan(1);

      await user.click(toggle());
      expect(toggle()).toHaveTextContent('Show panels');
      expect(screen.getAllByText('TXN-000003')).toHaveLength(1);
    });

    it('offers no related section for a break that stands alone', () => {
      setup('TXN-000005');
      expect(screen.queryByRole('button', { name: /Show panels/ })).not.toBeInTheDocument();
    });
  });
});
