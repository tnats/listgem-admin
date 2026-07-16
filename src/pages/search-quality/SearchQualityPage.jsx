import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { useHybridSearch } from '../../api/hooks';
import { mockFor } from './mockSearch';

const isPersonType = t => /^person$/i.test(t || '');

const JUDGE_KEY = 'searchJudgments_v1';

function loadJudgments() {
  try { return JSON.parse(sessionStorage.getItem(JUDGE_KEY)) || {}; } catch { return {}; }
}

function titleOf(r) {
  return r.display_name || r.title || r.name || r.metadata?.title || r.thing_id;
}

function ResultRow({ rank, r, relevance, onJudge }) {
  const f = r._fusion || {};
  const vectorOnly = f.lexical_rank == null && f.vector_rank != null;
  return (
    <div className="flex items-center gap-2 py-1.5 border-t border-gray-50 text-xs">
      <span className="w-5 text-right text-gray-400 tabular-nums">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-700 truncate">{titleOf(r)}</div>
        <div className="text-gray-400 flex items-center gap-1.5">
          <span>{r.type}</span>
          {f.lexical_rank != null && <span className="px-1 rounded bg-gray-100">L{f.lexical_rank}</span>}
          {f.vector_rank != null && <span className="px-1 rounded bg-gray-100">V{f.vector_rank}</span>}
          {vectorOnly && <span className="px-1 rounded bg-violet-50 text-violet-600">semantic-only</span>}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={() => onJudge(r.thing_id, relevance === true ? null : true)} className={`px-1.5 rounded ${relevance === true ? 'bg-green-600 text-white' : 'border border-gray-200 text-gray-400 hover:bg-gray-50'}`}>✓</button>
        <button onClick={() => onJudge(r.thing_id, relevance === false ? null : false)} className={`px-1.5 rounded ${relevance === false ? 'bg-red-500 text-white' : 'border border-gray-200 text-gray-400 hover:bg-gray-50'}`}>✗</button>
      </div>
    </div>
  );
}

// Type distribution over the result set — makes the #429 "Person floods
// type-implied queries" regression observable (backend returns no facets here,
// so it's computed client-side from the ranked results).
export function TypeDistribution({ facets, total, personFlood }) {
  const max = facets[0]?.count || 1;
  return (
    <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-gray-700">
          Type distribution <span className="text-gray-400 font-normal">· {total} results</span>
        </h2>
        {personFlood && (
          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
            Person-dominated · likely #429
          </span>
        )}
      </div>
      <div className="space-y-1">
        {facets.map(f => {
          const person = isPersonType(f.type);
          const share = total ? (f.count / total) * 100 : 0;
          return (
            <div key={f.type} className="flex items-center gap-2 text-xs">
              <span className={`w-28 shrink-0 truncate ${person ? 'text-amber-700 font-medium' : 'text-gray-600'}`}>{f.type}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
                <div className={`h-full ${person ? 'bg-amber-400' : 'bg-indigo-400'}`} style={{ width: `${(f.count / max) * 100}%` }} />
              </div>
              <span className="w-20 text-right tabular-nums text-gray-400">{f.count} · {share.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
      {personFlood && (
        <p className="mt-2 text-[11px] text-gray-400">
          Actors matching transitively via credits (“known for”) outrank the implied type — the #429
          regression. Judge the Person rows ✗ to capture it in the golden set.
        </p>
      )}
    </div>
  );
}

export default function SearchQualityPage() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const live = useHybridSearch(query);

  const data = live.data?.results ? live.data : (query ? mockFor(query) : null);
  const usingSample = !!query && !live.data?.results;
  const results = data?.results || [];

  // Type distribution (client-side facets) for the #429 Person-flood signal.
  const facetCounts = results.reduce((acc, r) => {
    const t = r.type || 'unknown';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const facets = Object.entries(facetCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  const personFlood = results.length >= 5 && facets[0] && isPersonType(facets[0].type);

  const [judgments, setJudgments] = useState(loadJudgments);
  const judged = judgments[query] || {};

  function judge(thingId, relevant) {
    const next = { ...judgments, [query]: { ...(judgments[query] || {}) } };
    if (relevant == null) delete next[query][thingId];
    else next[query][thingId] = relevant;
    setJudgments(next);
    try { sessionStorage.setItem(JUDGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
  }

  function exportGolden() {
    const set = Object.entries(judgments).map(([q, j]) => ({
      query: q,
      judgments: Object.entries(j).map(([thing_id, relevant]) => ({ thing_id, relevant })),
    }));
    const blob = new Blob([JSON.stringify(set, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'search-golden-queries.json'; a.click();
    URL.revokeObjectURL(url);
  }

  const lexical = [...results].filter(r => r._fusion?.lexical_rank != null).sort((a, b) => a._fusion.lexical_rank - b._fusion.lexical_rank);
  const semanticWins = results.filter(r => r._fusion?.lexical_rank == null && r._fusion?.vector_rank != null).length;
  const judgedCount = Object.keys(judgments).reduce((s, q) => s + Object.keys(judgments[q]).length, 0);

  return (
    <>
      <PageHeader
        title="Search Quality Inspector"
        description="Run a query, see its type distribution (the #429 Person-flood signal), compare lexical vs hybrid (RRF) ranking, and mark relevance to build the semantic-recall golden query set (#406 → #400)."
      />

      <form
        onSubmit={e => { e.preventDefault(); setQuery(input.trim()); }}
        className="mb-4 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Search query… (e.g. dune)"
          className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button type="submit" className="px-3 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700">Search</button>
        <button type="button" onClick={exportGolden} disabled={judgedCount === 0} className="px-3 py-2 rounded border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          Export golden set ({judgedCount})
        </button>
      </form>

      {!query ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          Enter a query to compare lexical vs hybrid ranking and judge relevance.
        </div>
      ) : (
        <>
          <div className={`mb-4 p-3 rounded border text-xs ${usingSample ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-indigo-100 bg-indigo-50 text-indigo-800'}`}>
            {usingSample
              ? <>Seeded sample — live <code>/search/hybrid</code> needs an authed session.</>
              : <>Live <code>/search/hybrid</code> · mode <span className="font-medium">{data.mode}</span> · {data.count} results.</>}
            {' '}<span className="text-violet-600">{semanticWins} semantic-only win(s)</span> the lexical ranker missed.
          </div>

          <TypeDistribution facets={facets} total={results.length} personFlood={personFlood} />

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-1">Lexical (FTS)</h2>
              <p className="text-[11px] text-gray-400 mb-1">ranked by lexical_rank · vector-only results excluded</p>
              {lexical.length ? lexical.map((r, i) => (
                <ResultRow key={r.thing_id} rank={i + 1} r={r} relevance={judged[r.thing_id]} onJudge={judge} />
              )) : <div className="text-xs text-gray-400 py-4">No lexical hits.</div>}
            </div>

            <div className="bg-white rounded-lg border border-indigo-100 p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-1">Hybrid (RRF)</h2>
              <p className="text-[11px] text-gray-400 mb-1">fused lexical + vector · semantic-only highlighted</p>
              {results.map((r, i) => (
                <ResultRow key={r.thing_id} rank={i + 1} r={r} relevance={judged[r.thing_id]} onJudge={judge} />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
