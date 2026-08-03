import React, { useState, useEffect, useRef } from 'react';
import { C, MONO, SANS, ACCENT, INK2, NEG, ERR } from '../styles/tokens.js';

// Hover-aware elements reproduce the design's `style-hover=` behaviour without CSS.
export function Btn({ style, hoverStyle, disabled, ...props }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      {...props}
      style={{ ...style, ...(h && !disabled ? hoverStyle : null) }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    />
  );
}

export function HoverRow({ as = 'div', style, hoverStyle, children, ...props }) {
  const [h, setH] = useState(false);
  const Tag = as;
  return (
    <Tag
      {...props}
      style={{ ...style, ...(h ? hoverStyle : null) }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {children}
    </Tag>
  );
}

/** Small square severity swatch. */
export function SevDot({ color, size = 7 }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: 2, background: color, flex: 'none' }}
    />
  );
}

/** Sort/caret marker. */
export function Caret({ open }) {
  return <span aria-hidden="true">{open ? '▴' : '▾'}</span>;
}

/** Close-on-outside-click / Escape helper. */
export function useDismiss(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}

/** Toast, bottom-centre, auto-dismissed by the caller. */
export function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 22,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 90,
        background: '#131a24',
        color: '#ffffff',
        padding: '9px 16px',
        borderRadius: 6,
        fontSize: 12,
        fontFamily: MONO,
        animation: 'riseIn 160ms ease-out',
      }}
    >
      {message}
    </div>
  );
}

/**
 * The one red panel in the app: a failed load, a rejected import, a halted reset, a
 * render that threw. The palette was hand-copied into each of those before this existed,
 * so they had drifted apart by a shade or two each.
 *
 * `compact` is the single-line form used inline above a form; the default is the block
 * form with a heading and room for actions underneath. `role` is a prop rather than
 * hardcoded: an alert interrupts a screen reader, which is right for something the
 * analyst just caused and wrong for a panel already inside an open dialog.
 */
export function Alert({ role = 'alert', title, children, onDismiss, actions, compact = false, style }) {
  const dismiss = onDismiss && (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss"
      style={{ border: 0, background: 'none', color: NEG, fontSize: 15, cursor: 'pointer', padding: '0 2px', alignSelf: 'flex-start' }}
    >
      ×
    </button>
  );
  // `style` last so a caller can retune the size or spacing; the title and body inherit
  // the container's font size rather than pinning their own, so one override moves both.
  const base = { display: 'flex', gap: 10, background: ERR.bg, border: `1px solid ${ERR.border}`, color: ERR.ink };

  if (compact) {
    return (
      <div role={role} style={{ ...base, alignItems: 'center', padding: '9px 13px', borderRadius: 7, fontSize: 12.5, ...style }}>
        <span style={{ flex: 1 }}>{children}</span>
        {dismiss}
      </div>
    );
  }
  return (
    <div role={role} style={{ ...base, alignItems: 'flex-start', padding: '16px 18px', borderRadius: 8, fontSize: 13, ...style }}>
      <div style={{ flex: 1 }}>
        {title && <strong style={{ display: 'block', fontWeight: 600 }}>{title}</strong>}
        <p style={{ margin: title ? '6px 0 0' : 0, textWrap: 'pretty' }}>{children}</p>
        {actions && <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>{actions}</div>}
      </div>
      {dismiss}
    </div>
  );
}

/** Copy text to the clipboard, best-effort, with a toast callback. */
export function copyText(text, label, flash) {
  const done = (ok) => flash(ok ? `${label} copied` : `Copy blocked — ${text}`);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => done(true),
      () => done(false),
    );
    return;
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    done(ok);
  } catch {
    done(false);
  }
}

/** Secondary (outline) button used across toolbars. */
export function GhostButton({ children, ...props }) {
  return (
    <Btn
      style={{
        border: `1px solid ${C.border}`,
        background: '#fff',
        color: INK2,
        padding: '5px 10px',
        fontSize: 12,
        borderRadius: 5,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
      hoverStyle={{ borderColor: '#c9d1dc' }}
      {...props}
    >
      {children}
    </Btn>
  );
}

/**
 * Strip between a tab's toolbar and its table naming the filters currently applied, with
 * a single control to drop them all. Sits in the seam, so its side borders continue the
 * card; renders nothing when no filter is active.
 *
 * Each tab builds its own `bits` — the vocabulary is tab-specific and belongs beside the
 * state it describes — and supplies an `onClear` that resets only its filters, never the
 * sort or view mode.
 */
export function FilterStrip({ bits, onClear }) {
  if (!bits.length) return null;
  return (
    <div style={{ background: C.surfaceAlt, borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: INK2 }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: '#7b8697' }}>{bits.join('  ·  ')}</span>
      <button type="button" onClick={onClear} style={{ border: 0, background: 'none', color: ACCENT, fontSize: 12, cursor: 'pointer', padding: 0 }}>Clear filters</button>
    </div>
  );
}

/** Segmented on/off pill (view + type toggles). */
export function segStyle(on) {
  return { background: on ? '#eaf0fd' : '#ffffff', color: on ? ACCENT : INK2 };
}

/**
 * Segmented control: one bordered capsule whose buttons are divided by internal
 * rules, per the design's `View` / `Type` toggles.
 * @param {{label: string, on: boolean, onClick: () => void, title?: string}[]} options
 */
export function SegGroup({ options }) {
  return (
    <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 5, overflow: 'hidden' }}>
      {options.map((o, i) => (
        <button
          key={o.label}
          type="button"
          onClick={o.onClick}
          title={o.title}
          style={{
            // Four longhands, not the `border` shorthand: React drops a shorthand's
            // side when a longhand key for it is in the same object, even when that
            // key is undefined — which left the first button on the UA's outset bevel.
            borderTop: 0,
            borderRight: 0,
            borderBottom: 0,
            borderLeft: i === 0 ? 0 : `1px solid ${C.border}`,
            padding: '5px 10px',
            fontSize: 12,
            cursor: 'pointer',
            ...segStyle(o.on),
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export { SANS, MONO };
