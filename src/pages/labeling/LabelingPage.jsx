import { useState, useEffect, useCallback } from 'react';
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

function EntityCard({ entity, typeCorrect, onToggleType, side }) {
  const ids = Object.entries(entity.ids || {});
  return (
    <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex gap-3">
        {entity.image_url ? (
          <img src={entity.image_url} alt="" className="w-16 h-24 object-cover rounded bg-gray-100" onError={e => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <div className="w-16 h-24 shrink-0 rounded bg-gray-100 flex items-center justify-center text-2xl font-semibold text-gray-300">
            {(entity.title || '?').charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 leading-snug">{entity.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">{entity.creator || '—'}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{entity.type}</span>
            {entity.year && <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{entity.year}</span>}
            {entity.source && (
              <a href={entity.url} target="_blank" rel="noreferrer" className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-indigo-600 hover:bg-gray-200">
                {entity.source} ↗
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 text-[11px] text-gray-400 space-y-0.5">
        {ids.length > 0 ? ids.map(([k, v]) => <div key={k}><span className="text-gray-400">{k}:</span> <span className="text-gray-500 tabular-nums">{v}</span></div>) : <div>no external ids</div>}
        <div className="flex items-center gap-2 pt-1">
          <span>quality</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded overflow-hidden max-w-[120px]">
            <div className={`h-full ${entity.quality_score < 0.5 ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${Math.round((entity.quality_score || 0) * 100)}%` }} />
          </div>
          <span className="tabular-nums text-gray-500">{(entity.quality_score ?? 0).toFixed(2)}</span>
        </div>
      </div>
      <button
        onClick={onToggleType}
        className={`mt-3 w-full text-xs py-1 rounded border ${
          typeCorrect ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-amber-300 bg-amber-50 text-amber-700'
        }`}
      >
        {side} type: <span className="font-medium">{typeCorrect ? `✓ ${entity.type} correct` : `✗ ${entity.type} wrong`}</span>
      </button>
    </div>
  );
}

export default function LabelingPage() {
  const { user } = useAuth();
  const query = useCandidatePairs();
  const saveLabel = useSaveGoldenLabel();

  const livePairs = query.data?.pairs;
  const usingSample = !livePairs || livePairs.length === 0;
  const pairs = usingSample ? MOCK_PAIRS : livePairs;

  const [index, setIndex] = useState(0);
  const [labels, setLabels] = useState(loadLabels);
  const [typeCorrect, setTypeCorrect] = useState({ left: true, right: true });

  const pair = pairs[index];
  const done = index >= pairs.length;
  const labeledCount = Object.keys(labels).length;

  const persist = useCallback((next) => {
    setLabels(next);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota — keep in memory */ }
  }, []);

  const commit = useCallback((matchType) => {
    if (!pair) return;
    const record = {
      pair_id: pair.pair_id,
      reason: pair.reason,
      left_thing_id: pair.left.thing_id,
      right_thing_id: pair.right.thing_id,
      match_type: matchType,
      left_type_correct: typeCorrect.left,
      right_type_correct: typeCorrect.right,
      labeler: user?.email || user?.username || 'unknown',
      labeled_at: new Date().toISOString(),
    };
    persist({ ...labels, [pair.pair_id]: record });
    saveLabel.mutate(record); // best-effort; local copy is the source of truth until #416 ships
    setTypeCorrect({ left: true, right: true });
    setIndex(i => i + 1);
  }, [pair, typeCorrect, labels, user, persist, saveLabel]);

  const exportLabels = useCallback(() => {
    const blob = new Blob([JSON.stringify(Object.values(labels), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `golden-labels-${labeledCount}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [labels, labeledCount]);

  // Keyboard-fast flow
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const mt = MATCH_TYPES.find(m => m.hint === e.key);
      if (mt) { commit(mt.key); return; }
      if (e.key === 't') setTypeCorrect(s => ({ ...s, left: !s.left }));
      else if (e.key === 'y') setTypeCorrect(s => ({ ...s, right: !s.right }));
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, pairs.length));
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
      else if (e.key === 'e') exportLabels();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit, exportLabels, pairs.length]);

  return (
    <>
      <PageHeader
        title="Golden-Set Labeling"
        description="Label entity pairs to build the eval golden set (#404 → #400). Keyboard: 1–4 to label · t / y type-correct · ← → navigate · e export."
      />

      <div className={`mb-4 p-3 rounded border text-xs ${usingSample ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-indigo-100 bg-indigo-50 text-indigo-800'}`}>
        {usingSample
          ? <>Seeded sample (fragmentation clusters + samples) — the live candidate-pair feed and durable store land with <code>#416</code>. Labels persist locally and export to JSON in the meantime.</>
          : <>Live candidate-pair feed.</>}
      </div>

      {/* Progress */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
          <div className="h-full bg-indigo-500" style={{ width: `${pairs.length ? (labeledCount / pairs.length) * 100 : 0}%` }} />
        </div>
        <span className="text-xs text-gray-500 tabular-nums">{labeledCount} labeled / {pairs.length}</span>
        <button onClick={exportLabels} disabled={labeledCount === 0} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          Export<Kbd>e</Kbd>
        </button>
      </div>

      {done ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-sm font-medium text-gray-700">All caught up</div>
          <p className="mt-1 text-xs text-gray-500">{labeledCount} pair(s) labeled in this batch.</p>
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
            {labels[pair.pair_id] && <span className="text-green-600">labeled: {labels[pair.pair_id].match_type.replace(/_/g, ' ')}</span>}
            <button onClick={() => setIndex(i => i + 1)} className="px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50">Skip →</button>
          </div>
        </>
      )}
    </>
  );
}
