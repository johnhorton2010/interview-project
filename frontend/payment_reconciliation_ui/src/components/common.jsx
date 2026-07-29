import React, { useState, useEffect, useRef } from 'react';
import { C, MONO, SANS, ACCENT, INK2 } from '../styles/tokens.js';

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
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        background: '#131a24',
        color: '#fff',
        padding: '9px 16px',
        borderRadius: 7,
        fontSize: 12.5,
        fontFamily: MONO,
        boxShadow: '0 8px 24px rgba(19,26,36,0.28)',
        animation: 'riseIn 140ms ease-out',
        maxWidth: '80vw',
      }}
    >
      {message}
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

/** Segmented on/off pill (view + type toggles). */
export function segStyle(on) {
  return { background: on ? '#eaf0fd' : '#ffffff', color: on ? ACCENT : INK2 };
}

export { SANS, MONO };
