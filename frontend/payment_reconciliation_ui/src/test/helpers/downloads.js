// CSV export capture for `downloadCsv` (src/domain/format.js).
//
// downloadCsv builds a Blob, hands it to URL.createObjectURL and clicks a synthetic
// <a download>. jsdom implements neither object URLs nor anchor activation, so all three
// are replaced here. The Blob is kept rather than discarded: the file a tab produces is
// behaviour worth asserting, and it is the only place the export column order and the
// per-settlement line expansion are visible from outside the component.

const downloads = [];
const blobsByUrl = new Map();
let seq = 0;

export function resetDownloads() {
  downloads.length = 0;
  blobsByUrl.clear();
}

export function installDownloadCapture() {
  URL.createObjectURL = (blob) => {
    const url = `blob:vitest/${(seq += 1)}`;
    blobsByUrl.set(url, blob);
    return url;
  };
  // downloadCsv revokes on a 0ms timer; the Blob is captured at click time, before that.
  URL.revokeObjectURL = (url) => void blobsByUrl.delete(url);
  HTMLAnchorElement.prototype.click = function click() {
    // getAttribute, not .href: jsdom's href getter re-serialises through the URL parser
    // and a `blob:vitest/1` value does not survive it intact.
    const url = this.getAttribute('href');
    downloads.push({ filename: this.download, url, blob: blobsByUrl.get(url) });
  };
}

export const downloadCount = () => downloads.length;

// Enough CSV parsing for what downloadCsv writes: comma separated, double-quoted cells
// with "" for an embedded quote.
function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

/**
 * The most recent export: `{ filename, text, lines, rows }`. `text` has the UTF-8 BOM
 * downloadCsv prepends stripped; `rows` are parsed cells, `rows[0]` being the header.
 */
export async function lastDownload() {
  const d = downloads.at(-1);
  if (!d) throw new Error('No CSV download was triggered.');
  const text = (await d.blob.text()).replace(/^\uFEFF/, '');
  const lines = text.split('\r\n');
  return { filename: d.filename, text, lines, rows: lines.map(parseCsvLine) };
}
