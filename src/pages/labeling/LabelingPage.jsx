import { useState, useEffect, useCallback, useRef } from 'react';
import PageHeader from '../../components/PageHeader';
import { useCandidatePairs, useSaveGoldenLabel } from '../../api/hooks';
import { useAuth } from '../../auth/AuthContext';
import { MOCK_PAIRS } from './mockPairs';

const STORAGE_KEY = 'goldenLabels_v1';

const MATCH_TYPES = [
  { key: 'same_work', label: 'Same Work', hint: '1', cls: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
  { key: 'same_edition', label: 'Same Edition', hint: '2', cls: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' },
  { key: 'different', label: 'Different', hint: '3', cls: 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100' },
  { key: 'not_a_match', label: 'Not a match', hint: '4', cls: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' },
];

const REASON_LABEL = {
  fragmentation_cluster: 'fragmentation cluster',
  near_duplicate: 'near-duplicate',
  random: 'random sample',
};

function loadLabels() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function Kbd({ children }) {
  return (
    <kbd className="ml-1.5 px-1 py-0.5 text-[10px] font-sans text-gray-400 bg-white border border-gray-200 rounded">
      {children}
    </kbd>
  );
}

// Coerce any backend field to a safe display string — metadata/canonical_ids can
// carry nested objects/arrays, which crash React if rendered directly.
function text(v) {
  if (v == null) return '';
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(', ');
  return text(v.name ?? v.title ?? v.value ?? Object.values(v).find(x => x != null));
}

function EntityCard({ entity, typeCorrect, onToggleType, side }) {
  const ids = Object.entries(entity.ids && typeof entity.ids === 'object' ? entity.ids : {});
  const title = text(entity.title);
  const type = text(entity.type);
  const qs = typeof entity.quality_score === 'number' ? entity.quality_score : Number(entity.quality_score) || 0;
  return (
    <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex gap-3">
        {typeof entity.image_url === 'string' && entity.image_url ? (
          <img src={entity.image_url} alt="" className="w-16 h-24 object-cover rounded bg-gray-100" onError={e => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <div className="w-16 h-24 shrink-0 rounded bg-gray-100 flex items-center justify-center text-2xl font-semibold text-gray-300">
            {(title || '?').charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 leading-snug">{title || '(untitled)'}</div>
          <div className="text-xs text-gray-500 mt-0.5">{text(entity.creator) || '—'}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {type && <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{type}</span>}
            {entity.year != null && <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{text(entity.year)}</span>}
            {entity.source && (
              <a href={typeof entity.url === 'string' ? entity.url : undefined} target="_blank" rel="noreferrer" className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-indigo-600 hover:bg-gray-200">
                {text(entity.source)} ↗
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 text-[11px] text-gray-400 space-y-0.5">
        {ids.length > 0 ? ids.map(([k, v]) => <div key={k}><span className="text-gray-400">{k}:</span> <span className="text-gray-500 tabular-nums">{text(v)}</span></div>) : <div>no external ids</div>}
        <div className="flex items-center gap-2 pt-1">
          <span>quality</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded overflow-hidden max-w-[120px]">
            <div className={`h-full ${qs < 0.5 ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${Math.round(qs * 100)}%` }} />
          </div>
          <span className="tabular-nums text-gray-500">{qs.toFixed(2)}</span>
        </div>
      </div>
      <button
        onClick={onToggleType}
        className={`mt-3 w-full text-xs py-1 rounded border ${
          typeCorrect ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-amber-300 bg-amber-50 text-amber-700'
        }`}
      >
        {side} type: <span className="font-medium">{typeCorrect ? `✓ ${type} correct` : `✗ ${type} wrong`}</span>
      </button>
    </div>
  );
}

export default function LabelingPage() {
  const { user } = useAuth();
  const query = useCandidatePairs();
  const saveLabel = useSaveGoldenLabel();
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Pull the whole pool so every pair is reachable — incl. the diverse
  // `random`/`different` tail that sorts last (the ≥100 + mix-of-types goal).
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const livePairs = query.data?.pages?.flatMap(p => p.pairs || []);
  const usingSample = !livePairs || livePairs.length === 0;
  const allPairs = usingSample ? MOCK_PAIRS : livePairs;
  const reasonCounts = allPairs.reduce((a, p) => ({ ...a, [p.reason]: (a[p.reason] || 0) + 1 }), {});

  const [reasonFilter, setReasonFilter] = useState('');
  const pairs = reasonFilter ? allPairs.filter(p => p.reason === reasonFilter) : allPairs;

  const [index, setIndex] = useState(0);
  const [labels, setLabels] = useState(loadLabels);
  const [saveStatus, setSaveStatus] = useState({}); // pair_id -> saving | saved | error
  const [typeCorrect, setTypeCorrect] = useState({ left: true, right: true });

  // Reset position when the reason filter changes — render-phase, not an effect.
  const [seenFilter, setSeenFilter] = useState(reasonFilter);
  if (reasonFilter !== seenFilter) { setSeenFilter(reasonFilter); setIndex(0); }

  const pair = pairs[index];
  const done = index >= pairs.length;
  const labeledCount = Object.keys(labels).length;
  const savedCount = Object.values(saveStatus).filter(s => s === 'saved').length;
  const errorCount = Object.values(saveStatus).filter(s => s === 'error').length;

  // Pool accounting from the server (#423): the candidate feed EXCLUDES already-labeled
  // pairs, so `remaining`/`total` is the UNLABELED count — the full pool = labeled + remaining.
  // (This is why the pool "shrinks" as you label; it's progress, not data loss.)
  const page0 = query.data?.pages?.[0];
  const serverLabeled = usingSample ? 0 : (page0?.labeled_count ?? 0);
  const serverRemaining = usingSample ? MOCK_PAIRS.length : (page0?.remaining ?? page0?.total ?? allPairs.length);
  const poolTotal = serverLabeled + serverRemaining;
  const sessionLabeled = allPairs.filter(p => labels[p.pair_id]).length; // labeled this load, not yet excluded server-side
  const labeledTotal = serverLabeled + sessionLabeled;
  const remainingNow = Math.max(poolTotal - labeledTotal, 0);

  const persist = useCallback((next) => {
    setLabels(next);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota — keep in memory */ }
  }, []);

  // Server is the source of truth (golden_labels). Advance optimistically, save
  // in the background, and surface the outcome so a failed save isn't silent.
  const commit = async (matchType) => {
    if (!pair) return;
    const id = pair.pair_id;
    const record = {
      pair_id: id,
      reason: pair.reason,
      left_thing_id: pair.left.thing_id,
      right_thing_id: pair.right.thing_id,
      match_type: matchType,
      left_type_correct: typeCorrect.left,
      right_type_correct: typeCorrect.right,
      labeler: user?.email || user?.username || 'unknown',
      labeled_at: new Date().toISOString(),
    };
    persist({ ...labels, [id]: record });
    setTypeCorrect({ left: true, right: true });
    setIndex(i => i + 1);
    if (usingSample) return; // no golden_labels store behind the seeded sample
    setSaveStatus(s => ({ ...s, [id]: 'saving' }));
    try {
      await saveLabel.mutateAsync(record);
      setSaveStatus(s => ({ ...s, [id]: 'saved' }));
    } catch {
      setSaveStatus(s => ({ ...s, [id]: 'error' }));
    }
  };

  const retryFailed = async () => {
    const failed = Object.keys(saveStatus).filter(id => saveStatus[id] === 'error');
    for (const id of failed) {
      const record = labels[id];
      if (!record) continue;
      setSaveStatus(s => ({ ...s, [id]: 'saving' }));
      try { await saveLabel.mutateAsync(record); setSaveStatus(s => ({ ...s, [id]: 'saved' })); }
      catch { setSaveStatus(s => ({ ...s, [id]: 'error' })); }
    }
  };

  const exportLabels = useCallback(() => {
    const blob = new Blob([JSON.stringify(Object.values(labels), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `golden-labels-${labeledCount}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [labels, labeledCount]);

  // Keyboard-fast flow. Keep the latest handlers in a ref so the listener binds
  // once (handlers are recreated each render under React Compiler).
  const kbdRef = useRef(null);
  useEffect(() => { kbdRef.current = { commit, exportLabels, pairsLen: pairs.length }; });
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const { commit, exportLabels, pairsLen } = kbdRef.current;
      const mt = MATCH_TYPES.find(m => m.hint === e.key);
      if (mt) { commit(mt.key); return; }
      if (e.key === 't') setTypeCorrect(s => ({ ...s, left: !s.left }));
      else if (e.key === 'y') setTypeCorrect(s => ({ ...s, right: !s.right }));
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, pairsLen));
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
      else if (e.key === 'e') exportLabels();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <PageHeader
        title="Golden-Set Labeling"
        description="Label entity pairs to build the eval golden set (#404 → #400). Keyboard: 1–4 to label · t / y type-correct · ← → navigate · e export."
      />

      <div className={`mb-4 p-3 rounded border text-xs ${usingSample ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-indigo-100 bg-indigo-50 text-indigo-800'}`}>
        {usingSample
          ? <>Seeded sample — live <code>/admin/er/candidate-pairs</code> needs an authed session. Labels persist locally + export to JSON.</>
          : <>Live feed — <span className="font-medium">{labeledTotal}</span> of <span className="font-medium">{poolTotal}</span> pairs labeled, <span className="font-medium">{remainingNow}</span> remaining{isFetchingNextPage ? ' · loading…' : ''}. Saved to the <code>golden_labels</code> store (#421). The feed only serves unlabeled pairs, so it shrinks as you go — that's progress, not data loss.</>}
      </div>

      {/* Progress */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
          <div className="h-full bg-indigo-500" style={{ width: `${poolTotal ? (labeledTotal / poolTotal) * 100 : 0}%` }} />
        </div>
        <span className="text-xs text-gray-500 tabular-nums">{labeledTotal} labeled · {remainingNow} remaining</span>
        {!usingSample && (
          <span className="text-xs tabular-nums">
            <span className="text-green-600">{savedCount} saved this session</span>
            {errorCount > 0 && <span className="text-red-600"> · {errorCount} failed</span>}
          </span>
        )}
        {errorCount > 0 && (
          <button onClick={retryFailed} className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">Retry failed</button>
        )}
        <button onClick={exportLabels} disabled={labeledCount === 0} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          Export<Kbd>e</Kbd>
        </button>
      </div>

      {/* Reason filter — deliberately mix types (diversity > volume) */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
        <button onClick={() => setReasonFilter('')} className={`px-2 py-0.5 rounded border ${!reasonFilter ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          All {allPairs.length}
        </button>
        {Object.keys(REASON_LABEL).filter(r => reasonCounts[r]).map(r => (
          <button key={r} onClick={() => setReasonFilter(reasonFilter === r ? '' : r)} className={`px-2 py-0.5 rounded border ${reasonFilter === r ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {REASON_LABEL[r]} {reasonCounts[r]}
          </button>
        ))}
      </div>

      {done ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-sm font-medium text-gray-700">{reasonFilter ? 'All caught up for this filter' : 'All caught up'}</div>
          <p className="mt-1 text-xs text-gray-500">
            {!usingSample
              ? <><span className="font-medium">{labeledTotal}</span> of {poolTotal} labeled in <code>golden_labels</code>{remainingNow > 0 ? <> · {remainingNow} still unlabeled</> : <> · nothing left to label 🎉</>}{errorCount > 0 && <span className="text-red-600"> · {errorCount} failed to save</span>}.</>
              : <>{labeledCount} pair(s) labeled in this batch.</>}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button onClick={() => setIndex(0)} className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Review from start</button>
            <button onClick={exportLabels} disabled={labeledCount === 0} className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">Export golden set</button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Pair {index + 1} of {pairs.length}
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{REASON_LABEL[pair.reason] || pair.reason}</span>
          </div>

          <div className="flex items-stretch gap-3">
            <EntityCard entity={pair.left} side="Left" typeCorrect={typeCorrect.left} onToggleType={() => setTypeCorrect(s => ({ ...s, left: !s.left }))} />
            <div className="flex items-center text-xs font-medium text-gray-300">vs</div>
            <EntityCard entity={pair.right} side="Right" typeCorrect={typeCorrect.right} onToggleType={() => setTypeCorrect(s => ({ ...s, right: !s.right }))} />
          </div>

          {/* Actions */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {MATCH_TYPES.map(m => {
              const chosen = labels[pair.pair_id]?.match_type === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => commit(m.key)}
                  className={`py-2 rounded border text-sm font-medium ${m.cls} ${chosen ? 'ring-2 ring-offset-1 ring-indigo-400' : ''}`}
                >
                  {m.label}<Kbd>{m.hint}</Kbd>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <button onClick={() => setIndex(i => Math.max(i - 1, 0))} disabled={index === 0} className="px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40">← Prev</button>
            {labels[pair.pair_id] && (
              <span className="text-gray-500">
                labeled: <span className="text-gray-700">{labels[pair.pair_id].match_type.replace(/_/g, ' ')}</span>
                {!usingSample && saveStatus[pair.pair_id] && (
                  <span className={saveStatus[pair.pair_id] === 'saved' ? 'text-green-600' : saveStatus[pair.pair_id] === 'error' ? 'text-red-600' : 'text-gray-400'}>
                    {' '}· {saveStatus[pair.pair_id] === 'saved' ? 'saved ✓' : saveStatus[pair.pair_id] === 'error' ? 'save failed' : 'saving…'}
                  </span>
                )}
              </span>
            )}
            <button onClick={() => setIndex(i => i + 1)} className="px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50">Skip →</button>
          </div>
        </>
      )}
    </>
  );
}
