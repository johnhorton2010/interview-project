// jsdom evaluates no media queries, so the MediaQueryList here is a fake the test drives
// directly. That is the whole surface worth checking: the hook's job is to report the
// initial match and then keep reporting it as the query flips, without leaking listeners.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery.js';

const original = window.matchMedia;

/** A MediaQueryList whose `matches` the test can flip, firing `change` as a browser would. */
function fakeMedia(initial) {
  const listeners = new Set();
  const mql = {
    media: '',
    matches: initial,
    addEventListener: vi.fn((type, fn) => type === 'change' && listeners.add(fn)),
    removeEventListener: vi.fn((type, fn) => type === 'change' && listeners.delete(fn)),
  };
  const install = () => {
    window.matchMedia = vi.fn((media) => {
      mql.media = media;
      return mql;
    });
  };
  const set = async (matches) => {
    mql.matches = matches;
    await act(async () => listeners.forEach((fn) => fn({ matches, media: mql.media })));
  };
  return { mql, install, set, listeners };
}

function mount(query) {
  const seen = [];
  function Probe() {
    seen.push(useMediaQuery(query));
    return null;
  }
  const view = render(<Probe />);
  return { ...view, at: () => seen.at(-1) };
}

afterEach(() => {
  window.matchMedia = original;
});

describe('useMediaQuery', () => {
  it('reports false when the platform has no matchMedia', () => {
    // The contract every caller relies on: phrase the query as a max-width and the absent
    // case falls back to the wide layout rather than the narrow one.
    delete window.matchMedia;
    expect(mount('(max-width: 799px)').at()).toBe(false);
  });

  it('reports the initial match, and passes the query through verbatim', () => {
    const media = fakeMedia(true);
    media.install();

    expect(mount('(max-width: 799px)').at()).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 799px)');
  });

  it('re-renders when the query starts and stops matching', async () => {
    const media = fakeMedia(false);
    media.install();
    const { at } = mount('(max-width: 799px)');
    expect(at()).toBe(false);

    await media.set(true);
    expect(at()).toBe(true);

    await media.set(false);
    expect(at()).toBe(false);
  });

  it('detaches its listener on unmount', () => {
    const media = fakeMedia(false);
    media.install();
    const { unmount } = mount('(max-width: 799px)');
    expect(media.listeners.size).toBe(1);

    unmount();
    expect(media.listeners.size).toBe(0);
    expect(media.mql.removeEventListener).toHaveBeenCalled();
  });
});
