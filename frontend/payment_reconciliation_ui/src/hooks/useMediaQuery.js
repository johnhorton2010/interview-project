// A CSS media query, read as React state.
//
// This app styles itself entirely with inline `style` objects — styles/global.css is a
// reset and nothing else — so a layout that has to change at a breakpoint cannot express
// that breakpoint in CSS. It reads the query here instead and branches the style object.
//
// The subscription matters as much as the initial match: a window dragged across the
// breakpoint has to re-lay out, not just a page loaded on the far side of it.

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * @param {string} query  a CSS media query, e.g. `(max-width: 799px)`
 * @returns {boolean} whether it currently matches
 */
export function useMediaQuery(query) {
  // jsdom implements no media queries, and neither does a server render. Both report `false`,
  // so callers must phrase the query so that `false` is the layout they want by default —
  // a `max-width` query, whose fallback is the wide layout.
  const mql = useMemo(
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null),
    [query],
  );

  const subscribe = useCallback(
    (onChange) => {
      if (!mql) return () => {};
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [mql],
  );

  const getSnapshot = useCallback(() => (mql ? mql.matches : false), [mql]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export default useMediaQuery;
