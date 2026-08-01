// Mirrors of the pristine per-tab view state in App.jsx, which keeps them module-private.
// App.test.jsx pins the pairing from the other side, by asserting what a cold load
// actually renders (Breaks sorted by discrepancy ↓, Transactions in Ledger view, no
// filters anywhere).
export const BR_DEFAULTS = {
  query: '',
  catFilter: [],
  merchantFilter: null,
  sortKey: 'impact',
  sortDir: 'desc',
  catOpen: false,
  helpOpen: false,
};

export const TX_DEFAULTS = {
  query: '',
  cats: [],
  type: 'all',
  view: 'ledger',
  sortKey: 'disc',
  sortDir: 'desc',
  catOpen: false,
  helpOpen: false,
};

export const MR_DEFAULTS = { query: '', breaksOnly: false };
