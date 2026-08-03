// Global test setup — runs before every test file (vite.config.js `setupFiles`).
//
// Everything here is a *browser* stub. jsdom implements the DOM; it does not implement the
// parts of the platform that touch layout, the GPU or navigation. No module under src/ is
// mocked, so the components run their real code paths — each stub below exists because a
// real path in this app throws without it.

import { beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Only *.test.jsx runs under jsdom, so this file also loads for the node-environment
// domain suites. Bail out there rather than making them pay for any of it.
if (typeof window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  const { installDownloadCapture, resetDownloads } = await import('./helpers/downloads.js');

  // Testing Library registers afterEach(cleanup) itself only when Vitest globals are on.
  // They are off here, so unmount by hand — otherwise the second test in a file finds two
  // of every table.
  afterEach(() => cleanup());

  // styles/columns.js measures rendered text with a detached canvas, in a layout effect
  // that fires on every render. jsdom has no 2d context: getContext() returns null, so
  // `ctx.font = …` throws and every table test dies on mount. ~7px per character is about
  // a 13px sans glyph; returning 0 would collapse every column to its `min` and make the
  // measurement path vacuous.
  const context2d = { font: '', measureText: (text) => ({ width: String(text).length * 7 }) };
  HTMLCanvasElement.prototype.getContext = (kind) => (kind === '2d' ? context2d : null);

  // jsdom performs no layout, so every element reports clientWidth 0. useColumns splits the
  // surplus (container − content − gaps) between columns; at 0 the surplus is always
  // negative and the slack is pinned to its floor, leaving the clamp and left-pad branches
  // permanently dead. 1600px fits the widest table (Breaks, 12 columns).
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1600 });

  // useColumns re-measures on container resize, guarded by `typeof ResizeObserver`, so
  // without this the observe/disconnect path never runs. Plain assignment rather than
  // vi.stubGlobal so a test's vi.unstubAllGlobals() cannot tear it back out.
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // jsdom performs no layout and so implements no media queries: window.matchMedia is simply
  // absent. hooks/useMediaQuery and App's reduced-motion check both guard against that and
  // fall back to `false`, which means their subscribe/listen paths would never run under test.
  // `matches: false` is exactly what those fallbacks already produce — the wide layout, motion
  // allowed — so this changes no existing assertion, it only lets the real path execute.
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (media) => ({
      media,
      matches: false,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    });
  }

  // App.scrollTabs() calls this 40ms after every nav jump. jsdom does not implement it, so
  // it throws *inside a timer* — outside any test's stack, surfacing against whatever runs
  // next. vi.fn so a test can assert that a cross-tab jump scrolled.
  Element.prototype.scrollIntoView = vi.fn();

  // jsdom's Blob implements no text(), which both App's settlement import (`file.text()`)
  // and the CSV capture below depend on. FileReader is implemented, so route through it.
  if (typeof Blob.prototype.text !== 'function') {
    Blob.prototype.text = function text() {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }

  // domain/format.js downloadCsv takes an object URL and clicks a synthetic <a download>;
  // jsdom implements neither. The stub keeps the Blob so tests can read back the CSV that
  // was actually produced.
  installDownloadCapture();

  beforeEach(() => {
    // App persists its "imported since the last reconciliation" flag in sessionStorage,
    // which lives as long as the environment — i.e. the whole test file.
    window.sessionStorage.clear();
    resetDownloads();
  });
}
