import React from 'react';
import { Alert, Btn } from './common.jsx';
import { ACCENT } from '../styles/tokens.js';

/**
 * Last resort. React unmounts the whole tree when a render throws, so without a boundary
 * any such error — a malformed payload reaching normalize(), a bad shape in a table cell —
 * leaves the analyst on a blank white page with nothing to act on and no clue why.
 *
 * Deliberately not a retry: the failure is in rendering the state we already hold, so
 * re-rendering the same state fails the same way. A reload is the honest offer.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Kept: the boundary swallows the throw, so this is the only trace left of it.
    console.error('Unhandled render error', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '64px 28px' }}>
        <Alert
          title="Something went wrong displaying the report."
          actions={
            <Btn
              onClick={() => window.location.reload()}
              style={{ border: `1px solid ${ACCENT}`, background: ACCENT, color: '#fff', padding: '7px 12px', fontSize: 13, borderRadius: 6, cursor: 'pointer' }}
              hoverStyle={{ background: '#2a55bd' }}
            >
              Reload the page
            </Btn>
          }
        >
          {error.message || String(error)}
        </Alert>
      </main>
    );
  }
}
