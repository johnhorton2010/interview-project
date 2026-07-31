// Design tokens, lifted verbatim from the design component so the React port
// reproduces its exact colors and typography. The design defines these as loose
// constants; we centralize them here and re-export the pieces components need.

export const MONO = "'IBM Plex Mono', monospace";
export const SANS = "'IBM Plex Sans', sans-serif";

// Core ink / accent palette.
export const NEG = '#b02a30'; // negative money, high-severity
export const POS = '#17714a'; // positive / clean
export const INK = '#131a24'; // primary text
export const INK2 = '#4c5768'; // secondary text
export const ACCENT = '#2f5fd0'; // links / primary action

// Neutral surface palette used throughout the design's inline styles.
export const C = {
  pageBg: '#f1f3f6',
  surface: '#ffffff',
  surfaceAlt: '#fbfcfd',
  border: '#e2e6ec',
  borderStrong: '#d8dee7',
  borderSoft: '#eef1f4',
  rowRule: '#f4f6f8',
  hover: '#f7f9fc',
  muted: '#7b8697',
  dim: '#9aa3b0',
  bandBg: '#f7f8fa', // section bands inside a table; the quarantined tile
  ink: INK,
  ink2: INK2,
  accent: ACCENT,
  accentHover: '#21449b',
  neg: NEG,
  pos: POS,
};

// Severity → visual encoding. `sev` values come from the category table (§8).
export const SEV_ORDER = { high: 0, medium: 1, low: 2, none: 3, excluded: 4 };
export const SEV_COLOR = {
  high: NEG,
  medium: '#a06400',
  low: '#5b6a7d',
  none: POS,
  excluded: '#8a8f9c',
};
export const SEV_BG = {
  high: '#fcecec',
  medium: '#fdf4e3',
  low: '#f1f3f6',
  none: '#eaf5ef',
  excluded: '#f1f3f6',
};
export const SEV_BORDER = {
  high: '#f2d2d2',
  medium: '#f0dfb8',
  low: '#e2e6ec',
  none: '#cfe6da',
  excluded: '#e2e6ec',
};
