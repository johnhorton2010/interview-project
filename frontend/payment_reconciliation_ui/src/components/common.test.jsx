// Shared primitives. Also the canary for the jsdom toolchain as a whole: if the JSX
// transform, the jest-dom matchers, the manual afterEach(cleanup) or user-event were
// misconfigured, this is the file that says so.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Btn, HoverRow, Toast, FilterStrip, SegGroup, segStyle, useDismiss, copyText } from './common.jsx';

describe('Toast', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<Toast message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces the message politely', () => {
    render(<Toast message="breaks.csv — 8 rows exported" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('breaks.csv — 8 rows exported');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});

describe('FilterStrip', () => {
  it('renders nothing when no filter is active', () => {
    const { container } = render(<FilterStrip bits={[]} onClear={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('joins the bits and clears them on demand', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<FilterStrip bits={['category: Duplicate settlement', 'merchant: MERCH-004']} onClear={onClear} />);

    // textContent, not getByText: the default matcher collapses the wide `  ·  ` gutter
    // the strip is built on.
    expect(screen.getByText(/category: Duplicate settlement/).textContent).toBe(
      'category: Duplicate settlement  ·  merchant: MERCH-004',
    );
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe('SegGroup', () => {
  const options = (onLedger, onSettlement) => [
    { label: 'Ledger', on: true, title: 'One row per internal ledger transaction', onClick: onLedger },
    { label: 'Settlement', on: false, title: 'One row per processor settlement', onClick: onSettlement },
  ];

  it('renders one button per option, tinting only the active one', () => {
    render(<SegGroup options={options(vi.fn(), vi.fn())} />);

    const ledger = screen.getByRole('button', { name: 'Ledger' });
    const settlement = screen.getByRole('button', { name: 'Settlement' });
    expect(ledger).toHaveStyle({ background: segStyle(true).background });
    expect(settlement).toHaveStyle({ background: segStyle(false).background });
    expect(ledger).toHaveAttribute('title', 'One row per internal ledger transaction');
  });

  it('calls the clicked option only', async () => {
    const user = userEvent.setup();
    const onLedger = vi.fn();
    const onSettlement = vi.fn();
    render(<SegGroup options={options(onLedger, onSettlement)} />);

    await user.click(screen.getByRole('button', { name: 'Settlement' }));
    expect(onSettlement).toHaveBeenCalledTimes(1);
    expect(onLedger).not.toHaveBeenCalled();
  });
});

describe('Btn / HoverRow', () => {
  it('applies hoverStyle on hover but not while disabled', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Btn style={{ color: 'rgb(0, 0, 0)' }} hoverStyle={{ color: 'rgb(255, 0, 0)' }}>Hit</Btn>);
    const btn = screen.getByRole('button', { name: 'Hit' });

    await user.hover(btn);
    expect(btn).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    await user.unhover(btn);
    expect(btn).toHaveStyle({ color: 'rgb(0, 0, 0)' });

    rerender(<Btn disabled style={{ color: 'rgb(0, 0, 0)' }} hoverStyle={{ color: 'rgb(255, 0, 0)' }}>Hit</Btn>);
    await user.hover(btn);
    expect(btn).toHaveStyle({ color: 'rgb(0, 0, 0)' });
  });

  it('renders as the requested tag', () => {
    render(<HoverRow as="button" type="button">Row</HoverRow>);
    expect(screen.getByRole('button', { name: 'Row' }).tagName).toBe('BUTTON');
  });
});

describe('useDismiss', () => {
  function Menu({ open, onClose }) {
    const ref = useDismiss(open, onClose);
    return (
      <div>
        <div ref={ref} data-testid="menu">
          <button type="button">inside</button>
        </div>
        <button type="button">outside</button>
      </div>
    );
  }

  it('closes on a mousedown outside, but not inside', () => {
    const onClose = vi.fn();
    render(<Menu open onClose={onClose} />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'inside' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Menu open onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('subscribes to nothing while closed', () => {
    const onClose = vi.fn();
    render(<Menu open={false} onClose={onClose} />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('copyText', () => {
  it('flashes a confirmation when the clipboard accepts the write', async () => {
    // user-event installs a navigator.clipboard stub, which is the branch the app takes
    // in a real browser.
    const user = userEvent.setup();
    const flash = vi.fn();

    copyText('TXN-000012', 'Internal txn id', flash);
    await vi.waitFor(() => expect(flash).toHaveBeenCalledWith('Internal txn id copied'));
    await expect(user.pointer && navigator.clipboard.readText()).resolves.toBe('TXN-000012');
  });

  it('flashes the text itself when the clipboard is unavailable', async () => {
    // No clipboard and no execCommand (jsdom implements neither) — the fallback throws
    // and is caught, which is the path a locked-down browser takes.
    const flash = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    try {
      copyText('ARN74000000000000058801', 'Network ref', flash);
      expect(flash).toHaveBeenCalledWith('Copy blocked — ARN74000000000000058801');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
