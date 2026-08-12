import { useCallback, useEffect, useRef, useState } from 'react';
import DataTable from '../../components/DataTable';
import { Button, Field, TextArea, TextInput } from '../../components/Form';
import { useImportParse, usePitchMutations, useResolve, useResolveBatch } from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';
import {
  ROW_STATUS,
  applyBatchResults,
  batchResults,
  chunkForBatch,
  normalizeResolution,
  normalizeParsed,
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

function CandidateRow({ candidate, chosen, onPick }) {
  return (
    <button
      onClick={onPick}
      className={`flex w-full items-baseline gap-2 rounded border px-2 py-1 text-left text-xs ${
        chosen ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <span className="min-w-0 flex-1 truncate text-gray-800">{candidate.title}</span>
      {candidate.creator && <span className="truncate text-gray-500">{candidate.creator}</span>}
      {candidate.type && <span className="text-gray-400">{candidate.type}</span>}
      {candidate.year != null && <span className="tabular-nums text-gray-400">{candidate.year}</span>}
      {candidate.score != null && (
        <span className="tabular-nums text-gray-400">{Number(candidate.score).toFixed(2)}</span>
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

  const parse = useImportParse();
  const resolveBatch = useResolveBatch();
  const resolveOne = useResolve();
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
  const focusedRow = rows[focus];

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

  async function runSearch(query) {
    if (!query.trim()) return;
    setBusy('searching');
    try {
      // /resolve requires a type; rows carry the parser's inferred_type when it
      // sent one, otherwise the pitch's own thing_type.
      const type = focusedRow?.inferred_type || thingType;
      const data = await resolveOne.mutateAsync({ type, title: query.trim() });
      const res = normalizeResolution(data);
      // The match leads, then the alternates — `suggestions` excludes the match
      // itself, so showing only one or the other loses a real option.
      const list = [res.match, ...res.candidates].filter(
        (c, i, all) => c && all.findIndex(o => o?.thing_id === c.thing_id) === i,
      );
      setSearchResults(list);
      if (list.length === 0) setNote({ ok: false, text: `No candidates for “${query.trim()}”.` });
    } catch (err) {
      setNote({ ok: false, text: `Search failed — ${apiErrorMessage(err)}` });
    } finally {
      setBusy(null);
    }
  }

  function pick(candidate) {
    patchRow(focus, {
      thing_id: candidate.thing_id,
      match: candidate,
      status: candidate.thing_id ? 'resolved' : 'ambiguous',
    });
    setSearchResults(null);
    setSearch('');
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
    { key: 'status', header: 'Status', width: 'w-24', render: row => <StatusPill status={row.status} /> },
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
          <Button onClick={() => setShowPaste(s => !s)}>{showPaste ? 'Hide paste box' : 'Paste more text'}</Button>
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
            <Button variant="primary" onClick={save} disabled={!!busy || rows.length === 0}>
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
                  key={c.thing_id || i}
                  candidate={c}
                  chosen={c.thing_id && c.thing_id === focusedRow.thing_id}
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
                  runSearch(search || focusedRow.raw_text);
                }}
              >
                <TextInput
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search registry — “${focusedRow.raw_text.slice(0, 32)}”`}
                />
                <Button type="submit" disabled={busy === 'searching'}>
                  Search
                </Button>
              </form>
              {searchResults && (
                <div className="mt-2 space-y-1">
                  {searchResults.length === 0 && <div className="text-xs text-gray-400">No candidates.</div>}
                  {searchResults.map((c, i) => (
                    <CandidateRow key={c.thing_id || i} candidate={c} chosen={false} onPick={() => pick(c)} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <TextInput
                value={focusedRow.note || ''}
                onChange={e => patchRow(focus, { note: e.target.value })}
                placeholder="Note for this row (internal)"
              />
              <div className="mt-2 text-[11px] text-gray-400">
                Resolving as <span className="font-medium text-gray-500">{focusedRow.inferred_type || thingType}</span>
                {focusedRow.reason && <> · server said <span className="text-gray-500">{focusedRow.reason}</span></>}
                {focusedRow.confidence != null && (
                  <> · confidence <span className="tabular-nums text-gray-500">{focusedRow.confidence}</span></>
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
