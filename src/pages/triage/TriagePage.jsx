import { useState, useMemo } from 'react';
import PageHeader from '../../components/PageHeader';
import { useLowQualityThings, useReEnrich, useReEnrichSweepStatus } from '../../api/hooks';
import { MOCK_LOW_QUALITY, MOCK_SWEEP } from './mockLowQuality';

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

// Read-only quality-tail re-enrich sweep status (#473 / #420). No kill switch /
// start button — the sweep is a manual CLI, not a daemon.
function SweepPanel({ sweep, isSample }) {
  if (!sweep || sweep.available === false) {
    return (
      <div className="mb-4 bg-white rounded-lg border border-dashed border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">Quality-tail sweep</h2>
          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">awaiting deploy</span>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Bulk worst-first re-enrich (#420). Live once <code>/admin/re-enrich/sweep/status</code> reports <code>available</code>.
        </p>
      </div>
    );
  }
  const processed = sweep.processed || 0;
  const remaining = sweep.remaining_candidates || 0;
  const totalPool = processed + remaining;
  const pct = totalPool > 0 ? (processed / totalPool) * 100 : 0;
  const delta = sweep.avg_quality_delta;
  const outcomes = sweep.outcomes || {};
  return (
    <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-gray-700">Quality-tail sweep</h2>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">manual CLI</span>
          {isSample && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">sample</span>}
        </div>
        <span className="text-xs text-gray-400">last run {fmtDate(sweep.last_run_at)}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 bg-gray-100 rounded overflow-hidden">
          <div className="h-full bg-indigo-400 rounded" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className="text-xs tabular-nums text-gray-500">{processed.toLocaleString()} / {totalPool.toLocaleString()}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3 text-xs">
        <div>
          <div className="text-lg font-semibold text-gray-900 tabular-nums">{remaining.toLocaleString()}</div>
          <div className="text-gray-400">remaining</div>
        </div>
        <div>
          <div className={`text-lg font-semibold tabular-nums ${delta > 0 ? 'text-green-700' : 'text-gray-900'}`}>
            {delta == null ? '—' : `${delta > 0 ? '+' : ''}${Number(delta).toFixed(2)}`}
          </div>
          <div className="text-gray-400">avg quality Δ</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900 tabular-nums">{(outcomes.improved ?? 0).toLocaleString()}</div>
          <div className="text-gray-400">improved</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900 tabular-nums">{(outcomes.merged ?? 0).toLocaleString()}</div>
          <div className="text-gray-400">merged</div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">Read-only — kicked from a CLI, never touches list memberships. Δ feeds the scorecard <code>low_quality_pct</code>.</p>
    </div>
  );
}

const ISSUE_LABEL = {
  missing_title: 'missing title',
  missing_image: 'missing image',
  missing_description: 'missing description',
  low_enrichment: 'low enrichment',
  uncertain_type: 'uncertain type',
  general_low_quality: 'general',
  person_as_content: 'person-as-content',
};
const ISSUE_CLS = {
  missing_title: 'bg-red-50 text-red-700',
  missing_image: 'bg-orange-50 text-orange-700',
  missing_description: 'bg-amber-50 text-amber-700',
  low_enrichment: 'bg-yellow-50 text-yellow-700',
  uncertain_type: 'bg-violet-50 text-violet-700',
  general_low_quality: 'bg-gray-100 text-gray-600',
  person_as_content: 'bg-rose-50 text-rose-700',
};

export default function TriagePage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [issueFilter, setIssueFilter] = useState('');
  const [status, setStatus] = useState({}); // thing_id -> 'queued' | 'done' | 'failed'

  const query = useLowQualityThings();
  const reEnrich = useReEnrich();
  const sweepQuery = useReEnrichSweepStatus();
  const sweep = sweepQuery.data || MOCK_SWEEP;
  const sweepIsSample = !sweepQuery.data;
  // person_as_content is quality-independent, so it's fetched server-side on demand
  // (?issue=person_as_content) rather than filtered from the quality<0.5 tail.
  const personActive = issueFilter === 'person_as_content';
  const personQuery = useLowQualityThings({ issue: 'person_as_content', minQuality: 1, enabled: personActive });

  const live = query.data && query.data.things ? query.data : null;
  const usingSample = !live;
  const data = live || MOCK_LOW_QUALITY;
  const things = useMemo(() => data.things || [], [data]);
  const breakdown = data.issue_breakdown || [];
  const heuristics = data.heuristics || {};

  // Show server-filtered person rows when that chip is active; otherwise the tail.
  // Fallback filters the loaded set (sample mode / while the server query loads).
  const personThings = personQuery.data?.things ?? things.filter(t => t.primary_issue === 'person_as_content');
  const displayThings = personActive ? personThings : things;

  const types = useMemo(() => [...new Set(displayThings.map(t => t.type))].sort(), [displayThings]);

  const rows = useMemo(
    () => displayThings.filter(t => (!typeFilter || t.type === typeFilter) && (personActive || !issueFilter || t.primary_issue === issueFilter)),
    [displayThings, typeFilter, issueFilter, personActive],
  );

  async function triage(thing) {
    setStatus(s => ({ ...s, [thing.thing_id]: 'queued' }));
    try {
      const res = await reEnrich.mutateAsync(thing.thing_id);
      setStatus(s => ({ ...s, [thing.thing_id]: res?.success === false ? 'failed' : 'done' }));
    } catch {
      setStatus(s => ({ ...s, [thing.thing_id]: 'failed' }));
    }
  }

  return (
    <>
      <PageHeader
        title="Extraction Triage"
        description="The low-quality tail (quality < 0.5), highest-impact first (usage × deficit). Re-enrich to re-run the pipeline — VLM rescue is live for the hard cases."
      />

      <div className={`mb-4 p-3 rounded border text-xs ${usingSample ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-indigo-100 bg-indigo-50 text-indigo-800'}`}>
        {usingSample
          ? <>Seeded sample — live <code>/metrics/low-quality-things</code> needs an authed session. Re-enrich POSTs best-effort to <code>/admin/re-enrich/:id</code>.</>
          : <>Live tail from <code>/metrics/low-quality-things</code>.</>}
      </div>

      <SweepPanel sweep={sweep} isSample={sweepIsSample} />

      {/* Issue breakdown */}
      <div className="mb-4 flex flex-wrap gap-2">
        {breakdown.map(b => (
          <button
            key={b.issue}
            onClick={() => setIssueFilter(issueFilter === b.issue ? '' : b.issue)}
            title={b.issue === 'person_as_content' ? heuristics.person_as_content : undefined}
            className={`text-xs px-2 py-1 rounded border ${issueFilter === b.issue ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-gray-200'} ${ISSUE_CLS[b.issue] || 'bg-gray-100 text-gray-600'}`}
          >
            {ISSUE_LABEL[b.issue] || b.issue} · <span className="tabular-nums">{Number(b.count).toLocaleString()}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-3 flex items-center gap-2 text-xs">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-2 py-1 border border-gray-200 rounded">
          <option value="">All types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(typeFilter || issueFilter) && (
          <button onClick={() => { setTypeFilter(''); setIssueFilter(''); }} className="text-gray-400 hover:text-gray-600">clear filters</button>
        )}
        <span className="text-gray-400 ml-auto tabular-nums">{rows.length} shown</span>
      </div>

      {personActive && (
        <div className="mb-3 -mt-1 text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded px-2 py-1.5">
          Quality-independent — these are wrong-<em>type</em> mistypes (article bylines extracted as a Person, #442),
          surfaced regardless of quality score. ~0 expected today; the chip lights up on regressions. Re-enrich re-runs the pipeline.
        </div>
      )}

      {/* Queue */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 uppercase text-left">
              <th className="pb-2">Title</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Issue</th>
              <th className="pb-2 text-right">Quality</th>
              <th className="pb-2 text-right">Enrich</th>
              <th className="pb-2 text-right">Uses</th>
              <th className="pb-2 text-right">Priority</th>
              <th className="pb-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => {
              const st = status[t.thing_id];
              return (
                <tr key={t.thing_id} className="border-t border-gray-50">
                  <td className="py-1.5 text-gray-700 font-medium">{t.title || <span className="text-red-500 italic">— no title —</span>}</td>
                  <td className="py-1.5 text-gray-500">{t.type}</td>
                  <td className="py-1.5"><span className={`px-1.5 py-0.5 rounded ${ISSUE_CLS[t.primary_issue] || ''}`}>{ISSUE_LABEL[t.primary_issue] || t.primary_issue}</span></td>
                  <td className="py-1.5 text-right tabular-nums"><span className={t.quality_score < 0.3 ? 'text-red-600' : 'text-gray-500'}>{Number(t.quality_score).toFixed(2)}</span></td>
                  <td className="py-1.5 text-right tabular-nums text-gray-500">{Number(t.enrichment_coverage).toFixed(2)}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-500">{t.usage_count}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-700 font-medium">{t.priority_score}</td>
                  <td className="py-1.5 text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      {st && (
                        <span className={`text-[10px] ${st === 'done' ? 'text-green-600' : st === 'failed' ? 'text-amber-600' : 'text-gray-400'}`}>
                          {st === 'queued' ? 'queued…' : st === 'done' ? 'queued ✓' : 'preview'}
                        </span>
                      )}
                      <button
                        onClick={() => triage(t)}
                        disabled={st === 'queued'}
                        className="px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >
                        Re-enrich
                      </button>
                      <button
                        disabled
                        title="DOM-vs-VLM extraction compare — pending #399 surface"
                        className="px-2 py-0.5 rounded border border-dashed border-gray-200 text-gray-300 cursor-not-allowed"
                      >
                        DOM/VLM
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-gray-400">No entries match the filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
