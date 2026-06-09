import { useState, useMemo } from 'react';
import PageHeader from '../../components/PageHeader';
import { useWorks, useWorkMutations } from '../../api/hooks';
import { MOCK_WORKS } from './mockEntities';

function idLabel(ids) {
  const e = Object.entries(ids || {});
  return e.length ? e.map(([k, v]) => `${k}:${v}`).join(' · ') : 'no ids';
}

export default function EntityBrowserPage() {
  const query = useWorks();
  const m = useWorkMutations();

  const liveWorks = query.data?.works;
  const usingSample = !liveWorks || liveWorks.length === 0;
  const source = usingSample ? MOCK_WORKS : liveWorks;

  const [works, setWorks] = useState(source);
  const [selectedId, setSelectedId] = useState(source[0]?.work_id);
  const [search, setSearch] = useState('');
  const [splitSel, setSplitSel] = useState(() => new Set());
  const [mergeTarget, setMergeTarget] = useState('');
  const [note, setNote] = useState(null);

  // Re-seed the local working copy when the underlying source identity changes
  // (e.g. live data arrives) — adjust during render, not in an effect.
  const [seenSource, setSeenSource] = useState(source);
  if (source !== seenSource) {
    setSeenSource(source);
    setWorks(source);
    setSelectedId(prev => (source.some(w => w.work_id === prev) ? prev : source[0]?.work_id));
  }

  const selected = works.find(w => w.work_id === selectedId);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? works.filter(w => `${w.title} ${w.creator}`.toLowerCase().includes(q)) : works;
  }, [works, search]);

  // Apply a local update immediately, fire the live call best-effort, report outcome.
  async function run(label, localUpdater, call) {
    setWorks(localUpdater);
    try {
      await call();
      setNote({ ok: true, text: `${label} — saved` });
    } catch {
      setNote({ ok: false, text: `${label} — local preview (backend unreachable)` });
    }
  }

  function setPrimary(work, thingId) {
    run(
      `Set primary → ${thingId}`,
      ws => ws.map(w => (w.work_id === work.work_id ? { ...w, representative_thing_id: thingId } : w)),
      () => m.setPrimary.mutateAsync({ workId: work.work_id, thing_id: thingId }),
    );
  }

  function splitSelected(work) {
    const ids = [...splitSel];
    if (!ids.length) return;
    const newWorkId = `w-split-${ids[0]}`;
    run(
      `Split ${ids.length} edition(s) → new Work`,
      ws => {
        const detached = work.editions.filter(e => ids.includes(e.thing_id));
        const remaining = work.editions.filter(e => !ids.includes(e.thing_id));
        const newWork = {
          work_id: newWorkId, title: detached[0].title, creator: work.creator, type: work.type,
          representative_thing_id: detached[0].thing_id, collections: [], editions: detached,
        };
        return ws
          .map(w => (w.work_id === work.work_id ? { ...w, editions: remaining, representative_thing_id: remaining[0]?.thing_id } : w))
          .filter(w => w.editions.length > 0)
          .concat(newWork);
      },
      () => m.split.mutateAsync({ workId: work.work_id, edition_thing_ids: ids, into: 'new_work' }),
    );
    setSplitSel(new Set());
  }

  function mergeInto(work, targetId) {
    if (!targetId) return;
    run(
      `Merge "${work.title}" → target Work`,
      ws => {
        const target = ws.find(w => w.work_id === targetId);
        if (!target) return ws;
        return ws
          .map(w => (w.work_id === targetId ? { ...w, editions: [...w.editions, ...work.editions] } : w))
          .filter(w => w.work_id !== work.work_id);
      },
      () => m.merge.mutateAsync({ source_work_id: work.work_id, target_work_id: targetId }),
    );
    setSelectedId(targetId);
    setMergeTarget('');
  }

  function dissolve(work) {
    if (!window.confirm(`Dissolve "${work.title}"? Its ${work.editions.length} edition(s) become standalone.`)) return;
    run(
      `Dissolve "${work.title}"`,
      ws => ws.filter(w => w.work_id !== work.work_id),
      () => m.dissolve.mutateAsync(work.work_id),
    );
    setSelectedId(null);
  }

  function toggleSplit(thingId) {
    setSplitSel(s => {
      const next = new Set(s);
      next.has(thingId) ? next.delete(thingId) : next.add(thingId);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title="Entity Browser"
        description="Browse Works ↔ editions ↔ collections and correct the graph by hand: set primary, split, merge, dissolve."
      />

      <div className={`mb-4 p-3 rounded border text-xs ${usingSample ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-indigo-100 bg-indigo-50 text-indigo-800'}`}>
        {usingSample
          ? <>Seeded sample — live <code>/works*</code> not reachable from here (needs an authed session). Actions preview locally and POST best-effort to <code>/admin/works/*</code>.</>
          : <>Live Works from <code>/works</code>.</>}
      </div>

      {note && (
        <div className={`mb-4 p-2 rounded text-xs ${note.ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {note.text}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Works list */}
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Works…"
            className="w-full mb-2 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="space-y-0.5 max-h-[28rem] overflow-y-auto">
            {filtered.map(w => (
              <button
                key={w.work_id}
                onClick={() => { setSelectedId(w.work_id); setSplitSel(new Set()); }}
                className={`w-full text-left px-2 py-1.5 rounded text-sm ${w.work_id === selectedId ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                <div className="font-medium truncate">{w.title}</div>
                <div className="text-xs text-gray-400 flex items-center gap-1.5">
                  <span className="truncate">{w.creator}</span>
                  <span className="shrink-0 px-1 rounded bg-gray-100 text-gray-500">{w.editions.length} ed.</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div className="text-xs text-gray-400 px-2 py-4 text-center">No Works.</div>}
          </div>
        </div>

        {/* Work detail */}
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-4">
          {!selected ? (
            <div className="text-sm text-gray-400 py-12 text-center">Select a Work.</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{selected.title}</h2>
                  <div className="text-sm text-gray-500">{selected.creator} · {selected.type}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {selected.collections?.length
                      ? selected.collections.map(c => (
                          <span key={c.collection_id} className="text-[11px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">{c.name} · {c.kind}</span>
                        ))
                      : <span className="text-[11px] text-gray-400">no collections</span>}
                  </div>
                </div>
                <button onClick={() => dissolve(selected)} className="shrink-0 text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">Dissolve</button>
              </div>

              {/* Editions */}
              <table className="w-full text-xs mt-4">
                <thead>
                  <tr className="text-gray-400 uppercase text-left">
                    <th className="pb-2 w-8"></th>
                    <th className="pb-2">Edition</th>
                    <th className="pb-2">Source</th>
                    <th className="pb-2 text-right">Year</th>
                    <th className="pb-2 text-right">Rank</th>
                    <th className="pb-2 text-right">Qual</th>
                    <th className="pb-2 text-center w-12">Split</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.editions.map(e => {
                    const isPrimary = e.thing_id === selected.representative_thing_id;
                    return (
                      <tr key={e.thing_id} className="border-t border-gray-50">
                        <td className="py-1.5">
                          <button
                            title={isPrimary ? 'Primary edition' : 'Set as primary'}
                            onClick={() => setPrimary(selected, e.thing_id)}
                            className={isPrimary ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}
                          >
                            {isPrimary ? '★' : '☆'}
                          </button>
                        </td>
                        <td className="py-1.5">
                          <div className="font-medium text-gray-700">{e.title}</div>
                          <div className="text-gray-400">{idLabel(e.ids)}</div>
                        </td>
                        <td className="py-1.5 text-gray-500">{e.source}</td>
                        <td className="py-1.5 text-right text-gray-500 tabular-nums">{e.year}</td>
                        <td className="py-1.5 text-right text-gray-500 tabular-nums">{e.ranking ?? '—'}</td>
                        <td className="py-1.5 text-right tabular-nums"><span className={e.quality_score < 0.5 ? 'text-red-500' : 'text-gray-500'}>{(e.quality_score ?? 0).toFixed(2)}</span></td>
                        <td className="py-1.5 text-center">
                          <input type="checkbox" checked={splitSel.has(e.thing_id)} onChange={() => toggleSplit(e.thing_id)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                <button
                  onClick={() => splitSelected(selected)}
                  disabled={splitSel.size === 0 || splitSel.size === selected.editions.length}
                  className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Split selected ({splitSel.size}) → new Work
                </button>
                <div className="flex items-center gap-1">
                  <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)} className="text-xs px-2 py-1 border border-gray-200 rounded">
                    <option value="">Merge into…</option>
                    {works.filter(w => w.work_id !== selected.work_id).map(w => (
                      <option key={w.work_id} value={w.work_id}>{w.title}</option>
                    ))}
                  </select>
                  <button onClick={() => mergeInto(selected, mergeTarget)} disabled={!mergeTarget} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">Merge</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
