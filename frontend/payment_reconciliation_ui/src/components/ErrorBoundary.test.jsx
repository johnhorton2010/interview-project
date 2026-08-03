// Without a boundary React unmounts the whole tree when a render throws, so the analyst
// gets a blank white page. These pin that the failure is at least legible and actionable.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary.jsx';

// React logs the caught error itself, and componentDidCatch logs it again on purpose.
// Both are expected here and would otherwise bury the real output.
beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

const Boom = () => {
  throw new Error('Malformed reconciliation payload: rows is not an array');
};

describe('ErrorBoundary', () => {
  it('renders its children untouched while nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>the report</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('the report')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('replaces a thrown render with the reason and a way out', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong displaying the report.');
    expect(alert).toHaveTextContent('Malformed reconciliation payload: rows is not an array');
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeEnabled();
  });

  it('leaves a trace of the error it swallowed', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(console.error).toHaveBeenCalledWith('Unhandled render error', expect.any(Error), expect.anything());
  });
});
