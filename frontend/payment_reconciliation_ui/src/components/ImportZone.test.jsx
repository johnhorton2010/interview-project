import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportZone from './ImportZone.jsx';

const card = (over = {}) => ({
  busy: false,
  result: null,
  entriesOpen: false,
  onToggleEntries: vi.fn(),
  onFile: vi.fn(),
  ...over,
});

const setup = (props = {}) => {
  const ledger = card(props.ledger);
  const settle = card(props.settle);
  const run = { onRun: vi.fn(), disabled: false, label: 'Run reconciliation', reconLine: null, ...props.run };
  const reset = { disabled: false, onOpen: vi.fn(), hint: 'Irreversible — deletes every imported record.', ...props.reset };
  const rest = {
    hasReport: false,
    importOpen: true,
    onCollapse: vi.fn(),
    onExpand: vi.fn(),
    collapsedSummary: '18 ledger · 19 settlements · 19 reconciled records',
    error: null,
    onDismissError: vi.fn(),
    ...props,
  };
  const view = render(<ImportZone {...rest} ledger={ledger} settle={settle} run={run} reset={reset} />);
  return { ...view, ledger, settle, run, reset, rest, user: userEvent.setup() };
};

/** The hidden file inputs, in render order: ledger then settlements. */
const fileInputs = (container) => [...container.querySelectorAll('input[type="file"]')];

const csv = () => new File(['id,amount\n'], 'internal_transactions.csv', { type: 'text/csv' });

describe('ImportZone', () => {
  describe('collapsed', () => {
    it('shows only the dataset summary once a report exists', async () => {
      const { rest, user } = setup({ hasReport: true, importOpen: false });

      expect(screen.getByText('18 ledger · 19 settlements · 19 reconciled records')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Import' })).not.toBeInTheDocument();

      await user.click(screen.getByText('Open import'));
      expect(rest.onExpand).toHaveBeenCalledTimes(1);
    });

    it('collapses again once expanded over a report', async () => {
      const { rest, user } = setup({ hasReport: true, importOpen: true });
      await user.click(screen.getByRole('button', { name: 'Collapse' }));
      expect(rest.onCollapse).toHaveBeenCalledTimes(1);
    });

    it('offers no Collapse before the first report exists', () => {
      setup({ hasReport: false });
      expect(screen.queryByRole('button', { name: 'Collapse' })).not.toBeInTheDocument();
    });
  });

  describe('drop cards', () => {
    it('invites a file and hands the picked one to the parent', () => {
      const { container, ledger } = setup();

      expect(screen.getByText('Internal Ledger — CSV format')).toBeInTheDocument();
      expect(screen.getAllByText('drop or click')).toHaveLength(2);

      const file = csv();
      fireEvent.change(fileInputs(container)[0], { target: { files: [file] } });

      expect(ledger.onFile).toHaveBeenCalledWith(file);
      // The name does not replace the hint yet: the card reports what the server accepted,
      // so it waits for the parent to hand back a result.
      expect(screen.queryByText('internal_transactions.csv')).not.toBeInTheDocument();
      expect(screen.getAllByText('.csv')).not.toHaveLength(0);
    });

    it('falls back to a bare confirmation when the result arrives without a local filename', () => {
      setup({ ledger: { result: { total: 1, changed: 1, unchanged: 0, entries: [['TXN-000001', 'INSERTED_OR_UPDATED']] } } });
      expect(screen.getByText('✓ imported')).toBeInTheDocument();
      expect(screen.getByText('imported')).toBeInTheDocument();
    });

    it('accepts a dropped file', () => {
      const { container, settle } = setup();
      const file = new File(['[]'], 'processor_settlement.json', { type: 'application/json' });
      const target = container.querySelectorAll('button')[1];

      fireEvent.dragOver(target);
      fireEvent.drop(target, { dataTransfer: { files: [file] } });
      expect(settle.onFile).toHaveBeenCalledWith(file);
    });

    it('shows the endpoint and swallows clicks while uploading', async () => {
      const { container, ledger, user } = setup({ ledger: { busy: true } });

      expect(screen.getByText('uploading')).toBeInTheDocument();
      expect(screen.getByText('PUT /api/v1/ledger-transactions…')).toBeInTheDocument();

      await user.click(screen.getByText('Internal Ledger — CSV format'));
      expect(ledger.onFile).not.toHaveBeenCalled();
    });

    it('summarises an import and lists the per-transaction outcomes on demand', async () => {
      const result = {
        total: 3,
        changed: 2,
        unchanged: 1,
        entries: [
          ['TXN-000001', 'INSERTED_OR_UPDATED'],
          ['TXN-000002', 'INSERTED_OR_UPDATED'],
          ['TXN-000003', 'NO_CHANGE'],
        ],
      };
      const { ledger, user } = setup({ ledger: { result } });

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('3 transactions accepted — 2 new or updated, 1 unchanged');
      expect(screen.queryByText('TXN-000003')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Per-transaction outcomes' }));
      expect(ledger.onToggleEntries).toHaveBeenCalledTimes(1);
    });

    it('lists every outcome once the parent opens the entries', () => {
      setup({
        ledger: {
          entriesOpen: true,
          result: {
            total: 3,
            changed: 2,
            unchanged: 1,
            entries: [
              ['TXN-000001', 'INSERTED_OR_UPDATED'],
              ['TXN-000002', 'INSERTED_OR_UPDATED'],
              ['TXN-000003', 'NO_CHANGE'],
            ],
          },
        },
      });

      expect(screen.getByText('TXN-000003')).toBeInTheDocument();
      expect(screen.getAllByText('INSERTED_OR_UPDATED')).toHaveLength(2);
      expect(screen.getByText('NO_CHANGE')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Hide outcomes' })).toBeInTheDocument();
    });
  });

  describe('error strip', () => {
    it('announces the failure and dismisses it', async () => {
      const { rest, user } = setup({ error: 'Expected a .csv file (the internal ledger export).' });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Expected a .csv file (the internal ledger export).');

      // Scoped: the stale banner in Report renders another control labelled "Dismiss".
      await user.click(within(alert).getByLabelText('Dismiss'));
      expect(rest.onDismissError).toHaveBeenCalledTimes(1);
    });
  });

  describe('run and reset controls', () => {
    it('carries the run label and recon line through', async () => {
      const { run, user } = setup({ run: { label: 'Re-run reconciliation', reconLine: '19 reconciled records' } });

      expect(screen.getByRole('status')).toHaveTextContent('19 reconciled records');
      await user.click(screen.getByRole('button', { name: 'Re-run reconciliation' }));
      expect(run.onRun).toHaveBeenCalledTimes(1);
    });

    it('disables the run button mid-reconciliation', () => {
      setup({ run: { label: 'Reconciling…', disabled: true } });
      expect(screen.getByRole('button', { name: 'Reconciling…' })).toBeDisabled();
    });

    it('opens the reset dialog and states the consequence', async () => {
      const { reset, user } = setup();
      await user.click(screen.getByRole('button', { name: 'Reset data' }));
      expect(reset.onOpen).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Irreversible — deletes every imported record.')).toBeInTheDocument();
    });

    it('disables reset while there is nothing to delete', () => {
      setup({ reset: { disabled: true, hint: 'Nothing imported yet.', onOpen: vi.fn() } });
      expect(screen.getByRole('button', { name: 'Reset data' })).toBeDisabled();
      expect(screen.getByText('Nothing imported yet.')).toBeInTheDocument();
    });
  });
});
