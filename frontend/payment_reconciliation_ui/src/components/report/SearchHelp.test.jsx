import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchHelp, { SEARCH_HELP } from './SearchHelp.jsx';

const popover = () => screen.getByText('Search').closest('div[style*="position: absolute"]');

const setup = (props = {}) => {
  const onToggle = vi.fn();
  const onClose = vi.fn();
  const view = render(<SearchHelp open={false} onToggle={onToggle} onClose={onClose} {...props} />);
  return { ...view, onToggle, onClose, user: userEvent.setup() };
};

describe('SearchHelp', () => {
  it('is collapsed until toggled', async () => {
    const { onToggle, user } = setup();
    const button = screen.getByRole('button', { name: '?' });

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Search')).not.toBeInTheDocument();

    await user.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('lists the whole search grammar when open', () => {
    setup({ open: true });

    expect(screen.getByRole('button', { name: '?' })).toHaveAttribute('aria-expanded', 'true');
    // Raw textContent, not getByText: several syntax rows separate their forms with a
    // double space that the default matcher collapses.
    const texts = [...popover().querySelectorAll('span')].map((s) => s.textContent);
    for (const [syntax, note] of SEARCH_HELP) {
      expect(texts).toContain(syntax);
      expect(texts).toContain(note);
    }
    expect(texts).toContain('2026-06-01..2026-06-05');
    expect(texts).toContain('type:refund  category:');
  });

  it('closes on the Close button, on Escape and on an outside mousedown', async () => {
    const { onClose, user } = setup({ open: true });

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not close on a mousedown inside the popover', () => {
    const { onClose } = setup({ open: true });
    fireEvent.mouseDown(screen.getByText('2026-06-05'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('anchors the popover to the side `align` names', () => {
    // `align` is used as a computed style key, so a typo here silently pins the popover
    // to the wrong edge rather than failing.
    const { unmount } = setup({ open: true, align: 'right' });
    expect(screen.getByText('Search').closest('div[style*="position: absolute"]')).toHaveStyle({ right: '0px' });
    unmount();

    setup({ open: true, align: 'left' });
    expect(screen.getByText('Search').closest('div[style*="position: absolute"]')).toHaveStyle({ left: '0px' });
  });
});
