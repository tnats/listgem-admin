import { useCallback, useEffect, useRef, useState } from 'react';
import DataTable from '../../components/DataTable';
import { Button, Field, TextArea, TextInput } from '../../components/Form';
import {
  useImportParse,
  usePitchMutations,
  useResolveBatch,
  useCrawlStatus,
  useResolveOrCreate,
  useSearchToAdd,
} from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';
import { typeMatchesPitch } from './pitchRules';
import {
  ROW_STATUS,
  applyBatchResults,
  batchResults,
  chunkForBatch,
  normalizeCandidate,
  normalizeParsed,
  normalizeSearchResults,
  searchTitle,
  pendingIndices,
  rowsFromItems,
  rowsFromParsed,
  summarize,
  toBatchPayload,
  toItemsPayload,
} from './resolveAdapter';

// The 60s server deadline for `pending`, walked in widening steps. Re-request
// those indices — a pending row is not an unresolved row.
const RECHECK_DELAYS_MS = [6000, 10000, 14000, 20000, 20000];

// Below this, a "Resolved" row is worth a second look before it reaches the
// target. Not a threshold the API applies — purely a prompt to the operator.
const LOW_CONFIDENCE = 0.7;

// How long focus must settle on a row before its search fires by itself.
// /search-to-add allows 20/min per user and each call spends external API quota,
// so j/k down a dozen unresolved rows must not spend a dozen searches.
const AUTOSEARCH_SETTLE_MS = 600;

function StatusPill({ status }) {
  const spec = ROW_STATUS[status] || ROW_STATUS.unresolved;
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${spec.cls}`}>{spec.label}</span>;
}

function Kbd({ children }) {
  return (
    <kbd className="ml-1 rounded border border-gray-200 bg-white px-1 py-0.5 font-sans text-[10px] text-gray-400">
      {children}
    </kbd>
  );
}

function CandidateRow({ candidate, chosen, onPick, busy }) {
  // A federated hit with no thing_id isn't in our registry yet. Picking it now
  // materialises it through the same kernel path a user add uses
  // (listgem-platform#550) — same Thing either way, so the dashed border is a
  // note about provenance, not a warning.
  const needsCreate = !candidate.thing_id;
  return (
    <button
      onClick={onPick}
      disabled={busy}
      title={needsCreate ? `Not in the registry yet — adds it from ${candidate.source || 'the source'}, then attaches` : undefined}
      className={`flex w-full items-baseline gap-2 rounded border px-2 py-1 text-left text-xs disabled:opacity-50 ${
        needsCreate
          ? 'border-dashed border-gray-300 hover:bg-gray-50'
          : chosen
            ? 'border-indigo-300 bg-indigo-50'
            : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <span className="min-w-0 flex-1 truncate text-gray-800">{candidate.title}</span>
      {candidate.creator && <span className="truncate text-gray-500">{candidate.creator}</span>}
      {candidate.type && <span className="text-gray-400">{candidate.type}</span>}
      {candidate.year != null && <span className="tabular-nums text-gray-400">{candidate.year}</span>}
      {candidate.score != null && (
        <span className="tabular-nums text-gray-400">{Number(candidate.score).toFixed(2)}</span>
      )}
      {needsCreate && (
        <span className="shrink-0 text-[10px] tracking-wide text-gray-400 uppercase">
          + add from {candidate.source || 'source'}
        </span>
      )}
    </button>
  );
}

/**
 * The staff build step: paste → parse → batch-resolve → adjudicate → replace the
 * item set. Deliberately not shared with the web app's resolution UI: same
 * endpoints, different job. A curator resolves one ambiguity mid-import; staff
 * bulk-adjudicate fifty rows, so this optimises for throughput.
 */
export default function PitchBuilder({ pitchId, thingType, items, readOnly, readOnlyReason }) {
  const [rows, setRows] = useState(() => rowsFromItems(items));
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(() => rowsFromItems(items).length === 0);
  const [focus, setFocus] = useState(0);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(null); // 'parsing' | 'resolving' | 'saving' | 'rechecking'
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [addUrl, setAddUrl] = useState('');
  // A link whose identifier we read but whose Thing we don't hold. Offering the
  // crawl explicitly, rather than doing it silently, keeps the "don't mint junk
  // from a random page" rule while unblocking the case where the identifier is
  // one the crawler resolves through a source API.
  const [creatable, setCreatable] = useState(null);

  const parse = useImportParse();
  const resolveBatch = useResolveBatch();
  const searchToAdd = useSearchToAdd();
  const resolveOrCreate = useResolveOrCreate();
  const crawlStatus = useCrawlStatus();
  const { saveItems } = usePitchMutations(pitchId);

  // Re-seed when the server's item set changes identity (detail query settles).
  const [seenItems, setSeenItems] = useState(items);
  if (items !== seenItems) {
    setSeenItems(items);
    setRows(rowsFromItems(items));
    setDirty(false);
  }

  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);

  // Latest rows for async work that started before the last render committed.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const counts = summarize(rows);
  // Items whose type can never live on this pitch. The API accepts them; the
  // trigger on list_items rejects them at provisioning, i.e. when the target
  // clicks the invite. Catch them here, where it costs nothing.
  const mismatched = rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => !row.dropped && row.thing_id && !typeMatchesPitch(row.match?.type, thingType));
  const focusedRow = rows[focus];
  const prefill = focusedRow ? searchTitle(focusedRow.raw_text) : '';

  // Moving to another row re-arms the box for that row: the previous row's
  // query and results are meaningless here. Keyed on the row's identity rather
  // than its index, so the first render arms too and a re-seed that changes the
  // row under the cursor doesn't leave a stale query behind. Render-phase, not
  // an effect.
  const searchKey = `${focus}:${focusedRow?.raw_text ?? ''}`;
  const [armedFor, setArmedFor] = useState(null);
  if (searchKey !== armedFor) {
    setArmedFor(searchKey);
    setSearch(prefill);
    setSearchResults(null);
    setCreatable(null);
  }

  const patchRow = useCallback((index, patch) => {
    setRows(rs => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setDirty(true);
  }, []);

  /**
   * One batch call per ≤200 rows, then chase the `pending` tail.
   * `source` is the row array the indices refer to — callers that have just
   * built new rows pass them in rather than waiting for the render to commit.
   * Notes and drops the operator makes mid-run are preserved on write-back.
   */
  const resolveIndices = useCallback(
    async (indices, { source, label = 'resolving' } = {}) => {
      if (indices.length === 0) return;
      setBusy(label);
      setNote(null);
      let working = source || rowsRef.current;
      const commit = next => {
        working = next;
        setRows(current =>
          current.length === next.length
            ? next.map((row, i) => ({ ...row, note: current[i].note, dropped: current[i].dropped }))
            : next,
        );
      };
      try {
        for (const chunk of chunkForBatch(indices)) {
          const data = await resolveBatch.mutateAsync(toBatchPayload(working, chunk, thingType));
          commit(applyBatchResults(working, batchResults(data), chunk));
        }
        setDirty(true);

        // Chase pending on the 60s deadline rather than calling them unresolved.
        for (const delay of RECHECK_DELAYS_MS) {
          const stillPending = pendingIndices(working);
          if (stillPending.length === 0 || cancelled.current) break;
          setBusy('rechecking');
          await new Promise(r => setTimeout(r, delay));
          if (cancelled.current) return;
          for (const chunk of chunkForBatch(stillPending)) {
            const data = await resolveBatch.mutateAsync(toBatchPayload(working, chunk, thingType));
            commit(applyBatchResults(working, batchResults(data), chunk));
          }
        }
      } catch (err) {
        setNote({ ok: false, text: `Resolve failed — ${apiErrorMessage(err)}` });
      } finally {
        setBusy(null);
      }
    },
    [resolveBatch, thingType],
  );

  async function parseAndResolve({ replace }) {
    if (!paste.trim()) return;
    setBusy('parsing');
    setNote(null);
    let parsed = [];
    try {
      parsed = normalizeParsed(await parse.mutateAsync(paste));
    } catch (err) {
      // No parser reachable — fall back to one row per non-empty line so the
      // operator can still build and resolve by hand.
      parsed = normalizeParsed(paste.split('\n').map((line, i) => ({ position: i + 1, raw_text: line.trim() })));
      setNote({
        ok: false,
        text: `Parser unreachable (${apiErrorMessage(err)}). Split ${parsed.length} line(s) locally instead.`,
      });
    }
    const fresh = rowsFromParsed(parsed);
    const next = replace ? fresh : [...rows, ...fresh];
    setRows(next);
    setDirty(true);
    setPaste('');
    setShowPaste(false);
    setBusy(null);
    const startAt = replace ? 0 : rows.length;
    await resolveIndices(fresh.map((_, i) => startAt + i), { source: next });
  }

  /**
   * Manual search goes through /search-to-add — the federated catalogue search
   * the web app's add flow uses. It was pointed at /resolve, which is the ER
   * duplicate-checker: it answers "do we already hold this candidate?" and
   * reports nothing for anything the matcher isn't confident about, which read
   * as "this doesn't exist" when it usually meant "ask a different question".
   */
  /**
   * Add a new item from a link. Distinct from the row editor's link box, which
   * re-points an existing row — pasting a link to "add this film" is what the
   * web app's composer does, so the builder needs to mean the same thing.
   */
  async function addRowFromUrl(url) {
    if (!url.trim()) return;
    setBusy('adding');
    setNote(null);
    try {
      const data = await resolveOrCreate.mutateAsync({ url: url.trim() });
      const match = normalizeCandidate({ ...(data.thing || {}), thing_id: data.thing_id });
      const row = {
        raw_text: match?.title || url.trim(),
        thing_id: data.thing_id,
        status: 'resolved',
        candidates: [],
        match,
        note: '',
        dropped: false,
        confidence: null,
        reason: null,
      };
      setRows(rs => [...rs, row]);
      setFocus(rows.length);
      setDirty(true);
      setAddUrl('');
      setNote({ ok: true, text: `Added “${row.raw_text}” as item ${rows.length + 1}.` });
    } catch (err) {
      const status = err?.response?.status;
      setNote({
        ok: false,
        text:
          status === 404 || status === 422
            ? `That link doesn't match anything we hold — search by title instead, which goes through the source catalogues and produces a better entry than a crawl would.`
            : `Could not add from that link — ${apiErrorMessage(err)}`,
      });
    } finally {
      setBusy(null);
    }
  }

  /**
   * Bring in a Thing from a link whose identifier we recognised but don't hold.
   *
   * Offered only after a 404 that returned canonical ids — never for an
   * arbitrary page. For an IMDb or TMDB link the crawler resolves through the
   * source API (crawlExtraction's imdb.com/title branch), so this produces the
   * same entry a search would, not a scrape of whatever the page happened to
   * expose. Creation is asynchronous: the API queues a crawl and hands back an
   * id to poll.
   */
  async function createFromLink({ url, row }) {
    setBusy('adding');
    setNote({ ok: true, text: 'Fetching it from the source…' });
    try {
      const queued = await resolveOrCreate.mutateAsync({ url, create: true });
      const crawlId = queued.crawl_id;
      if (!crawlId) throw new Error('No crawl id returned');

      for (let attempt = 0; attempt < 20; attempt++) {
        if (cancelled.current) return;
        await new Promise(r => setTimeout(r, 3000));
        const status = await crawlStatus.mutateAsync(crawlId);
        if (status.status === 'completed' && status.thingId) {
          const res = await resolveOrCreate.mutateAsync({ url });
          const match = normalizeCandidate({ ...(res.thing || {}), thing_id: res.thing_id || status.thingId });
          patchRow(row, { thing_id: res.thing_id || status.thingId, match, status: 'resolved' });
          setCreatable(null);
          setUrlInput('');
          setNote({ ok: true, text: `Added “${match?.title || status.thingId}” and attached it to row ${row + 1}.` });
          return;
        }
        if (status.status === 'failed') {
          setNote({ ok: false, text: `Couldn't fetch that link — ${status.error || 'the crawl failed'}. ${status.suggestion || 'Search by title instead.'}` });
          return;
        }
      }
      setNote({ ok: false, text: 'Still fetching after a minute. It may finish on its own — search by title, or try the link again shortly.' });
    } catch (err) {
      setNote({ ok: false, text: `Couldn't add from that link — ${apiErrorMessage(err)}` });
    } finally {
      setBusy(null);
    }
  }

  async function runSearch(query, { context = '' } = {}) {
    if (!query.trim()) return;
    setBusy('searching');
    try {
      // The pitch's type, always — see toBatchPayload. A row's current match
      // must never constrain the search intended to replace it.
      const type = thingType;
      const results = normalizeSearchResults(await searchToAdd.mutateAsync({ query: query.trim(), type }));
      setSearchResults(results);
      const sources = [...new Set(results.map(r => r.source).filter(Boolean))].join(', ');
      if (results.length === 0) {
        setNote({ ok: false, text: `${context}nothing found for “${query.trim()}” — try different wording, or leave the row for the target to fix.` });
      } else if (!results.some(r => r.in_registry)) {
        setNote({
          ok: true,
          text: `${context}found in ${sources || 'the source catalogues'} — picking one adds it and attaches it.`,
        });
      } else if (context) {
        setNote({ ok: true, text: `${context}found ${results.length} result(s) below.` });
      }
    } catch (err) {
      setNote({ ok: false, text: `Search failed — ${apiErrorMessage(err)}` });
    } finally {
      setBusy(null);
    }
  }

  /**
   * Attach a candidate. A registry hit attaches directly; a federated hit is
   * materialised first through the same kernel path a user add uses, so a Thing
   * created from a pitch is indistinguishable from one created any other way.
   */
  async function pick(candidate) {
    if (!typeMatchesPitch(candidate.type, thingType)) {
      setNote({
        ok: false,
        text: `“${candidate.title}” is ${candidate.type || 'an unknown type'}, and this is a ${thingType} pitch. A list can only hold one type, and the mismatch fails when the target claims the draft.`,
      });
      return;
    }
    if (candidate.thing_id) {
      const replaced = focusedRow?.match?.title;
      patchRow(focus, { thing_id: candidate.thing_id, match: candidate, status: 'resolved' });
      setSearchResults(null);
      setSearch('');
      // Say what was attached. Picking used to be silent, so a mis-click looked
      // identical to a correct one until you re-read the table.
      setNote({
        ok: true,
        text: `Row ${focus + 1} → “${candidate.title}”${candidate.year ? ` (${candidate.year})` : ''}${
          replaced && replaced !== candidate.title ? `, replacing “${replaced}”` : ''
        }.`,
      });
      return;
    }
    if (!candidate.source_id) {
      setNote({ ok: false, text: 'That result carries no source id, so it cannot be added.' });
      return;
    }
    setBusy('adding');
    setNote(null);
    try {
      const data = await resolveOrCreate.mutateAsync({
        source_type: candidate.source_type,
        source: candidate.source,
        source_id: candidate.source_id,
        type: candidate.type || thingType,
      });
      const match = normalizeCandidate({ ...(data.thing || {}), thing_id: data.thing_id }) || candidate;
      patchRow(focus, { thing_id: data.thing_id, match, status: 'resolved' });
      setSearchResults(null);
      setSearch('');
      setNote({
        ok: true,
        text: data.created
          ? `Added “${match.title}” to the registry and attached it.`
          : `“${match.title}” was already in the registry — attached.`,
      });
    } catch (err) {
      setNote({ ok: false, text: `Could not add that — ${apiErrorMessage(err)}` });
    } finally {
      setBusy(null);
    }
  }

  /**
   * Identify a Thing from a pasted link. Deliberately identify-only: the API
   * will not mint a Thing from a link's metadata, because one built from thin
   * OG tags is a permanent low-quality registry entry, and searching routes
   * through the source APIs and produces a better one. A miss says so.
   */
  async function resolveFromUrl(url) {
    if (!url.trim()) return;
    setBusy('adding');
    setNote(null);
    try {
      const data = await resolveOrCreate.mutateAsync({ url: url.trim() });
      const match = normalizeCandidate({ ...(data.thing || {}), thing_id: data.thing_id });
      const replaced = focusedRow?.match?.title;
      patchRow(focus, { thing_id: data.thing_id, match, status: 'resolved' });
      setUrlInput('');
      // Name the row and what it replaced: this changes one existing row rather
      // than adding an item, and an unannounced overwrite of a correct match is
      // the expensive mistake here.
      setNote({
        ok: true,
        text: replaced && replaced !== match?.title
          ? `Row ${focus + 1} re-pointed to “${match?.title || data.thing_id}” — replaced “${replaced}”.`
          : `Row ${focus + 1} matched to “${match?.title || data.thing_id}”.`,
      });
    } catch (err) {
      const status = err?.response?.status;
      const ids = err?.response?.data?.canonical_ids;
      const idText = ids && Object.keys(ids).length
        ? Object.entries(ids).map(([k, v]) => `${k} ${v}`).join(', ')
        : null;
      if (status === 404) {
        // We read the identifier and don't hold the thing — a coverage gap, not
        // a bad link. Searching finds it in the source catalogues, where one
        // click adds it, so run that search rather than describing it. The
        // context rides along so the search's own note doesn't erase the fact
        // that the link WAS understood.
        setBusy(null);
        setCreatable({ url: url.trim(), idText, row: focus });
        await runSearch(searchTitle(focusedRow?.raw_text || ''), {
          context: `Link read${idText ? ` (${idText})` : ''} but not in our registry — `,
        });
        return;
      }
      setNote({
        ok: false,
        text:
          status === 422
            ? `No identifier in that link — we can read IMDb, TMDB and Spotify links. Search by title instead.`
            : `Link lookup failed — ${apiErrorMessage(err)}`,
      });
    } finally {
      setBusy(null);
    }
  }

  function toggleDrop(index) {
    setRows(rs => rs.map((r, i) => (i === index ? { ...r, dropped: !r.dropped } : r)));
    setDirty(true);
  }

  async function save() {
    setBusy('saving');
    setNote(null);
    try {
      const payload = toItemsPayload(rows);
      const data = await saveItems.mutateAsync({ items: payload });
      setDirty(false);
      setRows(rs => rs.filter(r => !r.dropped));
      setNote({ ok: true, text: `Saved ${data?.item_count ?? payload.length} item(s).` });
    } catch (err) {
      setNote({ ok: false, text: `Save failed — ${apiErrorMessage(err)}` });
    } finally {
      setBusy(null);
    }
  }

  /**
   * Search by itself when a row needs it and offers nothing to pick from — the
   * operator's only moves there are find a match, leave it, or drop it.
   *
   * Guarded, because /search-to-add is rate-limited and externally metered:
   * only unresolved rows, only when the batch returned no candidates, once per
   * row per session, and only after focus has settled so keyboard navigation
   * doesn't spend the budget on rows passed through.
   */
  const autoSearched = useRef(new Set());
  const autoRef = useRef(null);
  useEffect(() => { autoRef.current = { focusedRow, prefill, runSearch, busy, readOnly }; });
  useEffect(() => {
    const timer = setTimeout(() => {
      const api = autoRef.current;
      if (!api || api.readOnly || api.busy) return;
      const row = api.focusedRow;
      if (!row || row.dropped || row.thing_id || row.status === 'pending') return;
      if (row.candidates?.length) return;
      const key = `${focus}:${row.raw_text}`;
      if (!api.prefill || autoSearched.current.has(key)) return;
      autoSearched.current.add(key);
      api.runSearch(api.prefill);
    }, AUTOSEARCH_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [focus, rows.length]);

  // Keyboard-first: staff review fifty rows at a time. Handlers live in a ref so
  // the listener binds once.
  const kbd = useRef(null);
  useEffect(() => {
    kbd.current = { rows, focus, toggleDrop, save, resolveIndices, readOnly };
  });
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const api = kbd.current;
      if (!api || api.rows.length === 0) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocus(f => Math.min(f + 1, api.rows.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocus(f => Math.max(f - 1, 0));
      } else if (e.key === 'x' && !api.readOnly) {
        api.toggleDrop(api.focus);
      } else if (e.key === 's' && !api.readOnly) {
        api.save();
      } else if (e.key === 'r' && !api.readOnly) {
        api.resolveIndices([api.focus]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const unresolvedIndices = rows.reduce((a, r, i) => (!r.dropped && r.status !== 'resolved' ? [...a, i] : a), []);
  const pending = pendingIndices(rows);

  const columns = [
    { key: 'n', header: '#', width: 'w-8', className: 'text-gray-400 tabular-nums', render: (_r, i) => i + 1 },
    {
      key: 'raw',
      header: 'Pasted text',
      render: row => (
        <span className={row.dropped ? 'text-gray-400 line-through' : 'text-gray-800'}>{row.raw_text}</span>
      ),
    },
    {
      key: 'match',
      header: 'Resolved to',
      render: row =>
        row.match?.title ? (
          <span className="text-gray-700">
            {row.match.title}
            {row.match.year != null && <span className="ml-1 text-gray-400 tabular-nums">{row.match.year}</span>}
            {row.match.type && <span className="ml-1 text-gray-400">· {row.match.type}</span>}
          </span>
        ) : row.thing_id ? (
          <code className="text-[11px] text-gray-500">{row.thing_id}</code>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-32',
      render: row => (
        <span className="flex items-center gap-1.5">
          <StatusPill status={row.status} />
          {/* A match at 0.4 and one at 1.0 both read as "Resolved" otherwise —
              and a confident-looking wrong match is the expensive kind. */}
          {row.thing_id && !typeMatchesPitch(row.match?.type, thingType) && (
            <span
              className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700"
              title={`This pitch is ${thingType}; the match is ${row.match?.type}. The target's claim would fail.`}
            >
              wrong type
            </span>
          )}
          {row.confidence != null && row.status === 'resolved' && (
            <span
              className={`text-[11px] tabular-nums ${
                row.confidence < LOW_CONFIDENCE ? 'font-medium text-amber-600' : 'text-gray-400'
              }`}
              title={row.confidence < LOW_CONFIDENCE ? 'Low confidence — check the year and creator' : 'Match confidence'}
            >
              {Number(row.confidence).toFixed(2)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'cands',
      header: 'Alts',
      width: 'w-12',
      align: 'right',
      className: 'text-gray-400 tabular-nums text-xs',
      render: row => (row.candidates?.length ? row.candidates.length : ''),
    },
    {
      key: 'actions',
      header: '',
      width: 'w-16',
      align: 'right',
      render: (row, i) =>
        readOnly ? null : (
          <Button
            size="sm"
            variant="ghost"
            onClick={e => {
              e.stopPropagation();
              toggleDrop(i);
            }}
          >
            {row.dropped ? 'Keep' : 'Drop'}
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-3">
      {readOnly && (
        <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">{readOnlyReason}</div>
      )}

      {note && (
        <div className={`rounded p-2 text-xs ${note.ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
          {note.text}
        </div>
      )}

      {mismatched.length > 0 && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          <span className="font-medium">
            Row {mismatched.map(m => m.i + 1).join(', ')} {mismatched.length === 1 ? 'is' : 'are'} not {thingType}.
          </span>{' '}
          Every item on a list must match the list's type — the database rejects a mismatch when the target
          claims the draft, so this would fail on them rather than on us. Re-match or drop{' '}
          {mismatched.length === 1 ? 'it' : 'them'} before saving.
        </div>
      )}

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="tabular-nums">
          <span className="font-medium text-gray-700">{counts.kept}</span> item(s)
        </span>
        <span className="tabular-nums text-green-600">{counts.resolved} resolved</span>
        <span className="tabular-nums text-yellow-600">{counts.ambiguous} ambiguous</span>
        <span className="tabular-nums text-gray-500">{counts.unresolved} unresolved</span>
        {counts.pending > 0 && <span className="tabular-nums text-blue-600">{counts.pending} pending</span>}
        {counts.dropped > 0 && <span className="tabular-nums text-gray-400">{counts.dropped} dropped</span>}
        {mismatched.length > 0 && (
          <span className="font-medium text-red-600 tabular-nums">{mismatched.length} wrong type</span>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-gray-400">
          <span>
            j/k row<Kbd>↑↓</Kbd>
          </span>
          <span>
            drop<Kbd>x</Kbd>
          </span>
          <span>
            re-resolve<Kbd>r</Kbd>
          </span>
          <span>
            save<Kbd>s</Kbd>
          </span>
        </div>
      </div>

      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          {/* The only control in this row that brings new content in; the rest act
              on what's already there. Styled apart because it was being lost
              among them — the add-by-link box lives inside this panel, and an
              operator looking for it couldn't find it. */}
          <Button
            onClick={() => setShowPaste(s => !s)}
            className="border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          >
            {showPaste ? '× Hide add panel' : '+ Add items or a link'}
          </Button>
          <Button
            disabled={unresolvedIndices.length === 0 || !!busy}
            onClick={() => resolveIndices(unresolvedIndices)}
          >
            Re-resolve {unresolvedIndices.length} unresolved
          </Button>
          {pending.length > 0 && (
            <Button disabled={!!busy} onClick={() => resolveIndices(pending, { label: 'rechecking' })}>
              Re-check {pending.length} pending
            </Button>
          )}
          <Button
            disabled={counts.unresolved === 0}
            onClick={() => {
              setRows(rs => rs.map(r => (r.status === 'unresolved' ? { ...r, dropped: true } : r)));
              setDirty(true);
            }}
          >
            Drop unresolved
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {dirty && <span className="text-xs text-amber-600">unsaved changes</span>}
            <Button
              variant="primary"
              onClick={save}
              disabled={!!busy || rows.length === 0 || mismatched.length > 0}
              title={
                mismatched.length > 0
                  ? `Row ${mismatched.map(m => m.i + 1).join(', ')} ${mismatched.length === 1 ? 'is' : 'are'} the wrong type for a ${thingType} pitch`
                  : undefined
              }
            >
              {busy === 'saving' ? 'Saving…' : 'Save items'}
              <Kbd>s</Kbd>
            </Button>
          </div>
        </div>
      )}

      {busy && busy !== 'saving' && (
        <div className="rounded bg-blue-50 p-2 text-xs text-blue-700">
          {busy === 'rechecking' ? 'Re-checking pending rows on the 60s deadline…' : `${busy}…`}
        </div>
      )}

      {/* Paste box */}
      {showPaste && !readOnly && (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <Field
            label="Paste the source list"
            hint="Numbered or bulleted text parses without an LLM call. One item per line otherwise."
          >
            <TextArea rows={6} value={paste} onChange={e => setPaste(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button variant="primary" disabled={!paste.trim() || !!busy} onClick={() => parseAndResolve({ replace: rows.length === 0 })}>
              {busy === 'parsing' ? 'Parsing…' : rows.length === 0 ? 'Parse & resolve' : 'Append & resolve'}
            </Button>
            {rows.length > 0 && (
              <Button disabled={!paste.trim() || !!busy} onClick={() => parseAndResolve({ replace: true })}>
                Replace all & resolve
              </Button>
            )}
          </div>

          <form
            className="mt-3 border-t border-gray-100 pt-3"
            onSubmit={e => {
              e.preventDefault();
              addRowFromUrl(addUrl);
            }}
          >
            <Field
              label="Or add one item by link"
              hint="IMDb, TMDB, Spotify… Matched on the identifier in the link, so an IMDb URL finds a film we ingested from TMDB. Appends a new item."
            >
              <div className="flex gap-2">
                <TextInput
                  value={addUrl}
                  onChange={e => setAddUrl(e.target.value)}
                  placeholder="https://www.imdb.com/title/tt0114814/"
                />
                <Button type="submit" disabled={!!busy || !addUrl.trim()}>
                  {busy === 'adding' ? 'Adding…' : 'Add item'}
                </Button>
              </div>
            </Field>
          </form>
        </div>
      )}

      {/* Rows */}
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <DataTable
          columns={columns}
          rows={rows}
          dense
          rowKey={(_r, i) => i}
          empty="No items yet — paste the source list above."
          onRowClick={(_r, i) => {
            setFocus(i);
            setSearchResults(null);
          }}
          isRowActive={(_r, i) => i === focus}
          rowClassName={row => (row.dropped ? 'opacity-60' : '')}
        />
      </div>

      {/* Focused-row editor */}
      {focusedRow && !readOnly && (
        <div className="rounded-lg border border-indigo-200 bg-white p-3">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400">Row {focus + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{focusedRow.raw_text}</span>
            <StatusPill status={focusedRow.status} />
          </div>

          {focusedRow.candidates?.length > 0 && (
            <div className="mb-3 space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-gray-400">Candidates</div>
              {focusedRow.candidates.map((c, i) => (
                <CandidateRow
                  key={`${i}-${c.thing_id || c.title}`}
                  candidate={c}
                  chosen={c.thing_id && c.thing_id === focusedRow.thing_id}
                  busy={busy === 'adding'}
                  onPick={() => pick(c)}
                />
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <form
                className="flex gap-2"
                onSubmit={e => {
                  e.preventDefault();
                  runSearch(search || searchTitle(focusedRow.raw_text));
                }}
              >
                <TextInput
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search catalogue — “${searchTitle(focusedRow.raw_text).slice(0, 32)}”`}
                />
                <Button type="submit" disabled={busy === 'searching'}>
                  Search
                </Button>
              </form>
              {searchResults && (
                <div className="mt-2 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-gray-400">
                    Search results{searchResults.length ? ` (${searchResults.length})` : ''}
                  </div>
                  {searchResults.length === 0 && <div className="text-xs text-gray-400">No candidates.</div>}
                  {searchResults.map((c, i) => (
                    <CandidateRow
                    key={`${i}-${c.thing_id || c.source_id || c.title}`}
                    candidate={c}
                    chosen={false}
                    busy={busy === 'adding'}
                    onPick={() => pick(c)}
                  />
                  ))}
                </div>
              )}
            </div>
            <div>
              <form
                className="flex gap-2"
                onSubmit={e => {
                  e.preventDefault();
                  resolveFromUrl(urlInput);
                }}
              >
                {/* "Re-point" only makes sense for a row that already points
                    somewhere. On an unresolved row there is nothing to re-point,
                    and that wording hid the box from an operator looking for a
                    way to match one. */}
                <TextInput
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder={
                    focusedRow.thing_id
                      ? `Re-point row ${focus + 1} using a link`
                      : `Match row ${focus + 1} using a link (IMDb, TMDB…)`
                  }
                />
                <Button type="submit" disabled={!!busy || !urlInput.trim()}>
                  {focusedRow.thing_id ? 'Re-point' : 'Match'}
                </Button>
              </form>
              {creatable && creatable.row === focus && (
                <div className="mt-2 rounded border border-dashed border-gray-300 p-2">
                  <div className="text-[11px] text-gray-500">
                    We read {creatable.idText || 'the identifier'} from that link but don't hold it yet. Fetching
                    it from the source adds it to the registry, same as picking a search result.
                  </div>
                  <Button
                    size="sm"
                    className="mt-1.5"
                    disabled={!!busy}
                    onClick={() => createFromLink(creatable)}
                  >
                    {busy === 'adding' ? 'Fetching…' : 'Add it from this link'}
                  </Button>
                </div>
              )}
              <TextInput
                className="mt-2"
                value={focusedRow.note || ''}
                onChange={e => patchRow(focus, { note: e.target.value })}
                placeholder="Note for this row (internal)"
              />
              <div className="mt-2 text-[11px] text-gray-400">
                Resolving as <span className="font-medium text-gray-500">{thingType}</span>
                {focusedRow.reason && <> · server said <span className="text-gray-500">{focusedRow.reason}</span></>}
                {focusedRow.confidence != null && (
                  <>
                    {' '}· confidence{' '}
                    <span
                      className={`tabular-nums ${
                        focusedRow.confidence < LOW_CONFIDENCE ? 'font-medium text-amber-600' : 'text-gray-500'
                      }`}
                    >
                      {Number(focusedRow.confidence).toFixed(2)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => toggleDrop(focus)}>
              {focusedRow.dropped ? 'Keep row' : 'Drop row'}
              <Kbd>x</Kbd>
            </Button>
            {focusedRow.thing_id && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => patchRow(focus, { thing_id: null, match: null, status: 'unresolved' })}
              >
                Clear match
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
