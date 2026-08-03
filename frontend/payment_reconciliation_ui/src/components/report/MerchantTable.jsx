import React, { useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { merchantRollup, matchMerchantAll } from '../../domain/selectors.js';
import { fmt, sfmt, neg, dec, decNeg, downloadCsv } from '../../domain/format.js';
import { C, INK } from '../../styles/tokens.js';
import { useColumns } from '../../styles/columns.js';
import { useWindowedRows, useRowMetrics, rowHeight } from '../../hooks/useWindowedRows.js';
import { bodyRow, headerRow, totalRow, totalLabel, rowRule, discColor, deductionColor } from '../../styles/table.js';
import { HoverRow, GhostButton, SegGroup, FilterStrip } from '../common.jsx';
import { HeadCell, Num, EmptyState, TableFooter, GlyphKey } from './TableParts.jsx';
import { MERCHANT_HELP as HELP } from './columnHelp.js';
import { COL, EXPORT_COLUMNS, project } from './exportColumns.js';

const SPEC = [
  { key: 'merchant', min: 72 },
  { key: 'sales', min: 64, align: 'right' },
  { key: 'refunds', min: 64, align: 'right' },
  // Parts before their total: INTERCHG + PROC = FEES, then SALES − REFUNDS − FEES = EXP
  // PAY, so every total in the row follows its own inputs.
  { key: 'interchange', min: 64, align: 'right' },
  { key: 'processor', min: 56, align: 'right' },
  { key: 'fees', min: 48, align: 'right' },
  { key: 'expected', min: 64, align: 'right' },
  { key: 'settled', min: 64, align: 'right' },
  { key: 'discrepancy', min: 64, align: 'right' },
  { key: 'clean', min: 40, align: 'right' },
  { key: 'breaks', min: 40, align: 'right' },
  { key: 'quarantine', min: 56, align: 'right' },
];
// Search grammar for this tab. Narrower than Breaks or Transactions on purpose: a
// rollup row has no ids, refs, dates or category — only a merchant and its money.
const SEARCH_TITLE =
  'Terms are combined with AND. Plain text matches the merchant id. A decimal matches any ' +
  'money column — sales, refunds, interchange, processor, fees, expected pay, settled or discrepancy.';

// Positions in SPEC that hold money. The three trailing counts are plain integers, and
// the merchant id is text, so only these are sized by magnitude.
const MONEY_COLS = new Set([1, 2, 3, 4, 5, 6, 7, 8]);

/**
 * One merchant.
 *
 * Memoized because this table windows its rows and re-slices as the page scrolls; without
 * it every row still on screen would re-render on every scroll tick. Every row is the
 * same height — there is no subline and nothing expands — so one shape covers the table.
 */
const MerchantRow = React.memo(function MerchantRow({ m, rowIndex, template, gap, cell, onOpen }) {
  return (
    <HoverRow
      role="row"
      aria-rowindex={rowIndex}
      data-row-shape="row"
      onClick={() => onOpen(m)}
      style={{ ...bodyRow(template, gap), ...rowRule }}
      hoverStyle={{ background: C.hover }}
    >
      {/* The merchant id is this row's identity, so it keeps full ink at the table's
          base size — the treatment Transactions gives its own id column. */}
      <span role="cell" style={{ ...cell('merchant'), color: INK }}>{m.merchantId}</span>
      <Num style={cell('sales')} color={INK}>{m.sales}</Num>
      {/* A quarantine-only merchant reads N/A here, and `deductionColor(0)` keeps it
          neutral — the same neutral a genuine zero gets. */}
      <Num style={cell('refunds')} color={deductionColor(m.raw.refunds)}>{m.refunds}</Num>
      <Num style={cell('interchange')} color={deductionColor(m.raw.interchange)}>{m.interchange}</Num>
      <Num style={cell('processor')} color={deductionColor(m.raw.processor)}>{m.processor}</Num>
      <Num style={cell('fees')} color={deductionColor(m.raw.fees)}>{m.fees}</Num>
      <Num style={cell('expected')} color={INK}>{m.expected}</Num>
      <Num style={cell('settled')} color={INK}>{m.settled}</Num>
      {/* A quarantine-only row prints N/A over a raw disc of 0, which `discColor`
          already renders in normal ink — no special case needed. */}
      <Num style={{ ...cell('discrepancy'), fontWeight: 500 }} color={discColor(m.raw.disc)}>
        {m.discrepancy}
      </Num>
      <Num style={cell('clean')} color={INK}>{m.clean}</Num>
      <Num style={cell('breaks')} color={INK}>{m.breaks}</Num>
      <Num style={cell('quarantine')} color={INK}>{m.quarantine}</Num>
    </HoverRow>
  );
});

// `mr` is owned by App, not held here: this component unmounts on every tab switch, so
// local state would forget a deliberate filter each time you left.
export default function MerchantTable({ model, nav, mr, setMr, flash }) {
  const { breaksOnly } = mr;
  const tableRef = useRef(null);

  // The input stays synchronous; the filter behind it is allowed to lag a frame.
  const query = useDeferredValue(mr.query);

  const { rows: all } = merchantRollup(model);
  const rows = useMemo(
    () => all.filter((m) => (!breaksOnly || m.hasBreaks) && matchMerchantAll(m, query)),
    [all, breaksOnly, query],
  );

  const filterBits = [];
  if (breaksOnly) filterBits.push('show: Breaks only');
  if (query.trim()) filterBits.push('search: "' + query.trim() + '"');

  // The Total reflects what is on screen, not the whole model, so a filtered table never
  // shows a total its own rows do not add up to. Quarantine-only merchants sum harmlessly:
  // every money field is 0 and only `quar` is non-zero.
  const KEYS = ['sales', 'refunds', 'interchange', 'processor', 'fees', 'expected', 'settled', 'disc', 'clean', 'breaks', 'quar'];
  // One accumulator mutated in place, rather than a fresh eleven-key object per row.
  const t = useMemo(() => {
    const acc = Object.fromEntries(KEYS.map((k) => [k, 0]));
    rows.forEach((m) => KEYS.forEach((k) => (acc[k] += m.raw[k])));
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  const filtered = rows.length < all.length;
  const totalLabelText = filtered ? `Total — ${rows.length} of ${all.length} merchants` : 'Total';

  // ---- column sizing
  //
  // The widest string each column's body has to print, declared for useColumns rather
  // than walked off the DOM — a windowed table renders only the rows on screen, so
  // measuring the DOM would make track widths follow the scroll position. See the header
  // of styles/columns.js.
  //
  // Every column here is monospace, so longest is widest and one pass over the raw
  // magnitudes suffices. `N/A` is offered alongside the figures because a fully
  // quarantined merchant prints that instead of a number.
  const candidates = useMemo(() => {
    const text = new Array(SPEC.length).fill('');
    const bare = new Array(SPEC.length).fill(-1);
    const signed = new Array(SPEC.length).fill(-1);
    const put = (i, s2) => {
      if (s2 && s2.length > text[i].length) text[i] = s2;
    };
    const widen = (arr, i, v) => {
      if (v > arr[i]) arr[i] = v;
    };
    /** Sales, Exp pay: `fmt` signs only a negative. */
    const m = (i, v) => {
      if (v === null || v === undefined) return;
      widen(v < 0 ? signed : bare, i, Math.abs(v));
    };
    /** The four deductions print through `neg`, which signs every non-zero; Discrepancy
     *  prints through `sfmt`, which signs a positive too. A zero prints bare. */
    const mNeg = (i, v) => {
      if (v === null || v === undefined) return;
      widen(v ? signed : bare, i, Math.abs(v));
    };

    const feed = (src, quarOnly) => {
      m(1, src.sales);
      mNeg(2, src.refunds);
      mNeg(3, src.interchange);
      mNeg(4, src.processor);
      mNeg(5, src.fees);
      m(6, src.expected);
      m(7, src.settled);
      mNeg(8, src.disc);
      if (quarOnly) MONEY_COLS.forEach((i) => put(i, 'N/A'));
      put(9, String(src.clean));
      put(10, String(src.breaks));
      put(11, String(src.quar));
    };

    rows.forEach((mr2) => {
      put(0, mr2.merchantId);
      feed(mr2.raw, mr2.raw.quarantineOnly);
    });
    // The Total row too: its label is the longest string the first column ever prints and
    // its figures are the largest in the table, so a column fitted only to the body rows
    // would clip them. It was measured for free by the DOM walk this replaces.
    put(0, totalLabelText);
    feed(t, false);

    return SPEC.map((c, i) => {
      if (!MONEY_COLS.has(i)) return text[i];
      const a = bare[i] < 0 ? '' : fmt(bare[i]);
      const b = signed[i] < 0 ? '' : '−' + fmt(signed[i]);
      const widest = b.length > a.length ? b : a;
      return widest.length >= text[i].length ? widest : text[i];
    });
  }, [rows, t, totalLabelText]);

  const { template: COLS, gap: GAP, cell } = useColumns(tableRef, SPEC, { candidates });

  // ---- windowing
  const H = useRowMetrics(tableRef, COLS);
  const bandRef = useRef(null);
  const window_ = useWindowedRows({
    count: rows.length,
    // Uniform: no sublines, nothing expands.
    heightOf: useCallback(() => rowHeight(H, 'row', false), [H]),
    sig: `${rows.length}|${JSON.stringify(H)}`,
    ref: bandRef,
  });
  const visible = rows.slice(window_.start, window_.end);

  const openMerchant = useCallback(
    (m) =>
      m.raw.quarantineOnly
        ? nav.toQuarantine()
        : m.hasBreaks
          ? nav.toBreaks({ merchantFilter: m.merchantId, catFilter: [] })
          : nav.toTransactions({ query: `merchant:${m.merchantId}` }),
    [nav],
  );

  const exportCsv = () => {
    const n = downloadCsv(
      'merchant-rollup.csv',
      EXPORT_COLUMNS.merchants,
      rows.map((m) => {
        // A fully-quarantined merchant contributes to nothing but its own count.
        const na = (v) => (m.raw.quarantineOnly ? 'N/A' : v);
        return project(EXPORT_COLUMNS.merchants, {
          [COL.merchant]: m.merchantId,
          [COL.sales]: na(dec(m.raw.sales)),
          [COL.refunds]: na(decNeg(m.raw.refunds)),
          [COL.interchange]: na(decNeg(m.raw.interchange)),
          [COL.processor]: na(decNeg(m.raw.processor)),
          [COL.fees]: na(decNeg(m.raw.fees)),
          [COL.expected]: na(dec(m.raw.expected)),
          [COL.settled]: na(dec(m.raw.settled)),
          [COL.discrepancy]: na(dec(m.raw.disc)),
          [COL.clean]: na(m.raw.clean),
          [COL.breaks]: na(m.raw.breaks),
          [COL.quarantine]: m.raw.quar,
        });
      }),
    );
    flash(`merchant-rollup.csv — ${n} rows exported`);
  };

  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Merchant Rollup</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
            Click a row to see backing transactions.
          </p>
          <input
            type="search"
            value={mr.query}
            onChange={(e) => setMr((m) => ({ ...m, query: e.target.value }))}
            placeholder="Search merchant or amount — e.g. MERCH-004 or 1186.63"
            title={SEARCH_TITLE}
            style={{ display: 'block', width: '100%', marginTop: 10, padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, color: INK, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Show</span>
            <SegGroup
              options={[
                { label: 'All', on: !breaksOnly, title: 'Every merchant in the report', onClick: () => setMr((m) => ({ ...m, breaksOnly: false })) },
                { label: 'Breaks only', on: breaksOnly, title: 'Only merchants with at least one break', onClick: () => setMr((m) => ({ ...m, breaksOnly: true })) },
              ]}
            />
          </div>
          <GhostButton onClick={exportCsv}>Export CSV</GhostButton>
        </div>
      </div>

      <FilterStrip bits={filterBits} onClear={() => setMr((m) => ({ ...m, query: '', breaksOnly: false }))} />

      {/* `aria-rowcount` is the whole table, not the rendered slice: a windowed band has only
          its visible rows in the DOM, and without this a screen reader would be told the
          table is fifty rows long. Header row included, hence the +1. */}
      <div ref={tableRef} role="table" aria-label="Merchant rollup" aria-rowcount={rows.length + 1} style={{ fontSize: 13 }}>
        <div role="row" aria-rowindex={1} style={headerRow(COLS, GAP)}>
          <HeadCell style={cell('merchant')} help={HELP.merchant}>Merchant</HeadCell>
          <HeadCell style={cell('sales')} help={HELP.sales}>Sales</HeadCell>
          <HeadCell style={cell('refunds')} help={HELP.refunds}>Refunds</HeadCell>
          <HeadCell style={cell('interchange')} help={HELP.interchange}>Interchg</HeadCell>
          <HeadCell style={cell('processor')} help={HELP.processor}>Proc</HeadCell>
          <HeadCell style={cell('fees')} help={HELP.fees}>Fees</HeadCell>
          <HeadCell style={cell('expected')} help={HELP.expected}>Exp pay</HeadCell>
          <HeadCell style={cell('settled')} help={HELP.settled}>Settled</HeadCell>
          <HeadCell style={cell('discrepancy')} help={HELP.discrepancy}>Discrepancy</HeadCell>
          <HeadCell style={cell('clean')} help={HELP.clean}>Clean</HeadCell>
          <HeadCell style={cell('breaks')} help={HELP.breaks}>Breaks</HeadCell>
          <HeadCell style={cell('quarantine')} help={HELP.quarantine}>Quarantine</HeadCell>
        </div>

        {rows.length === 0 && <EmptyState>No merchants match these filters.</EmptyState>}

        {/* Stands in for the rows above the window, and marks the band's top for the
            scroll geometry. Rendered even at zero height so the ref always has an element
            and the DOM shape does not change with the row count. */}
        <div ref={bandRef} aria-hidden="true" style={{ height: window_.padTop }} />
        {visible.map((m, i) => (
          <MerchantRow
            key={m.merchantId}
            m={m}
            rowIndex={window_.start + i + 2}
            template={COLS}
            gap={GAP}
            cell={cell}
            onOpen={openMerchant}
          />
        ))}
        {window_.padBottom > 0 && <div aria-hidden="true" style={{ height: window_.padBottom }} />}

        <div role="row" style={totalRow(COLS, GAP)}>
          <span role="cell" style={totalLabel}>{totalLabelText}</span>
          <Num style={cell('sales')} color={INK}>{fmt(t.sales)}</Num>
          <Num style={cell('refunds')} color={deductionColor(t.refunds)}>{neg(t.refunds)}</Num>
          <Num style={cell('interchange')} color={deductionColor(t.interchange)}>{neg(t.interchange)}</Num>
          <Num style={cell('processor')} color={deductionColor(t.processor)}>{neg(t.processor)}</Num>
          <Num style={cell('fees')} color={deductionColor(t.fees)}>{neg(t.fees)}</Num>
          <Num style={cell('expected')} color={INK}>{fmt(t.expected)}</Num>
          <Num style={cell('settled')} color={INK}>{fmt(t.settled)}</Num>
          <Num style={cell('discrepancy')} color={discColor(t.disc)}>{sfmt(t.disc)}</Num>
          <Num style={cell('clean')} color={INK}>{t.clean}</Num>
          <Num style={cell('breaks')} color={INK}>{t.breaks}</Num>
          <Num style={cell('quarantine')} color={INK}>{t.quar}</Num>
        </div>
      </div>
      <TableFooter
        left={<span style={{ textWrap: 'pretty' }}>Quarantined records count only in the Quarantine column — they never touch sales, refunds, fees, expected, settled or discrepancy.<br/>A merchant whose records are all quarantined reads N/A across those columns.</span>}
        legend={<GlyphKey keys={['na']} />}
      />
    </section>
  );
}
