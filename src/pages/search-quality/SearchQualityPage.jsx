import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { useHybridSearch } from '../../api/hooks';
import { MOCK_HYBRID } from './mockSearch';

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

export default function SearchQualityPage() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const live = useHybridSearch(query);

  const data = live.data?.results ? live.data : (query ? MOCK_HYBRID : null);
  const usingSample = !!query && !live.data?.results;
  const results = data?.results || [];

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
        description="Run a query, compare lexical vs hybrid (RRF) ranking, and mark relevance to build the semantic-recall golden query set (#406 → #400)."
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
