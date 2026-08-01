// ResetModal is fully controlled, so every case here is a pure function of props: the
// phase matrix, the confirm-phrase gate, and which dismissals are honoured mid-run.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetModal from './ResetModal.jsx';
import { RESET_STEPS } from '../api/reset.js';

const setup = (props = {}) => {
  const handlers = { setPhrase: vi.fn(), onConfirm: vi.fn(), onClose: vi.fn() };
  const view = render(
    <ResetModal open phase="confirm" phrase="" done={[]} failedAt={null} error={null} {...handlers} {...props} />,
  );
  return { ...view, ...handlers, user: userEvent.setup() };
};

const stepRows = () =>
  RESET_STEPS.map((st) => screen.getByText(st.endpoint).closest('div[style*="grid"]'));

const statuses = () => stepRows().map((row) => row.lastElementChild.textContent);

describe('ResetModal', () => {
  it('renders nothing while closed', () => {
    const { container } = setup({ open: false });
    expect(container).toBeEmptyDOMElement();
  });

  describe('confirm phase', () => {
    it('is a named modal dialog listing every delete step as pending', () => {
      setup();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAccessibleName('Delete all data');
      expect(within(dialog).getByText(/irreversible operation/)).toBeInTheDocument();
      expect(statuses()).toEqual(['pending', 'pending', 'pending']);
    });

    it('gates the confirm button on the phrase, trimmed and case-folded', () => {
      const { rerender } = setup();
      const confirm = () => screen.getByRole('button', { name: 'Delete everything' });
      expect(confirm()).toBeDisabled();

      const props = { open: true, phase: 'confirm', done: [], setPhrase: vi.fn(), onConfirm: vi.fn(), onClose: vi.fn() };
      rerender(<ResetModal {...props} phrase="RESE" />);
      expect(confirm()).toBeDisabled();

      rerender(<ResetModal {...props} phrase="  reset  " />);
      expect(confirm()).toBeEnabled();

      rerender(<ResetModal {...props} phrase="RESET" />);
      expect(confirm()).toBeEnabled();
    });

    it('reports each keystroke to the parent', async () => {
      const { setPhrase, user } = setup();
      await user.type(screen.getByLabelText('Type RESET to confirm'), 'R');
      expect(setPhrase).toHaveBeenCalledWith('R');
    });

    it('confirms when the phrase matches', async () => {
      const { onConfirm, user } = setup({ phrase: 'RESET' });
      await user.click(screen.getByRole('button', { name: 'Delete everything' }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('focuses the phrase input', async () => {
      setup();
      // The focus call is deferred 40ms, so this cannot be asserted synchronously.
      await waitFor(() => expect(screen.getByLabelText('Type RESET to confirm')).toHaveFocus());
    });

    it('closes on Escape and on a backdrop mousedown, but not on the dialog itself', () => {
      const { onClose } = setup();

      fireEvent.mouseDown(screen.getByRole('dialog'));
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('running phase', () => {
    it('refuses every dismissal while deletes are in flight', () => {
      const { onClose } = setup({ phase: 'running', done: ['recon'] });

      expect(screen.getByRole('dialog')).toHaveAccessibleName('Deleting data');
      expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: /Delete everything|Retry/ })).not.toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('marks the finished steps cleared and the current one deleting', () => {
      setup({ phase: 'running', done: ['recon'] });
      expect(statuses()).toEqual(['cleared', 'deleting', 'pending']);
    });
  });

  describe('done phase', () => {
    it('reports every dataset cleared', () => {
      setup({ phase: 'done', done: RESET_STEPS.map((s) => s.key) });

      expect(screen.getByRole('dialog')).toHaveAccessibleName('All ingested data deleted');
      expect(statuses()).toEqual(['cleared', 'cleared', 'cleared']);
      expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
      expect(screen.queryByLabelText('Type RESET to confirm')).not.toBeInTheDocument();
    });
  });

  describe('failed phase', () => {
    const failed = {
      phase: 'failed',
      done: [RESET_STEPS[0].key],
      failedAt: RESET_STEPS[1].key,
      error: { status: 500, body: 'nope' },
    };

    it('names the endpoint that failed and stops attributing anything after it', () => {
      setup(failed);

      expect(statuses()).toEqual(['cleared', 'failed', 'not attempted']);
      const panel = screen.getByRole('status');
      expect(panel).toHaveTextContent(`${RESET_STEPS[1].endpoint} returned 500 — nope`);
      expect(panel).toHaveTextContent('nothing after the failure was attempted');
    });

    it('offers a retry rather than a fresh confirmation', () => {
      setup(failed);
      expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeEnabled();
      expect(screen.queryByLabelText('Type RESET to confirm')).not.toBeInTheDocument();
    });

    it('says "could not be reached" when the failure carried no status', () => {
      setup({ ...failed, error: { message: 'Could not reach the reconciliation service.' } });
      expect(screen.getByRole('status')).toHaveTextContent(
        `${RESET_STEPS[1].endpoint} could not be reached — Could not reach the reconciliation service.`,
      );
    });

    it('truncates a runaway error body', () => {
      setup({ ...failed, error: { status: 500, body: 'x'.repeat(400) } });
      expect(screen.getByRole('status')).toHaveTextContent(`— ${'x'.repeat(160)}.`);
    });
  });
});
