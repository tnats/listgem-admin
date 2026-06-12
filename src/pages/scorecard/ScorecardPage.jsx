import PageHeader from '../../components/PageHeader';
import Sparkline from '../../components/Sparkline';
import {
  useQualitySummary,
  useSeedStatus,
  useDeduplicationEffectiveness,
  useQualityTrends,
  useWorkRollup,
  useScorecardHistory,
} from '../../api/hooks';
import { BASELINE, BASELINE_DATE } from './baseline';

const ISSUE_URL = 'https://github.com/tnats/listgem-platform/issues';

// --- formatting -----------------------------------------------------------
function fmt(value, format) {
  if (value == null || Number.isNaN(value)) return '—';
  if (format === 'pct') return `${value.toFixed(1)}%`;
  if (format === 'score') return value.toFixed(3);
  return Math.round(value).toLocaleString();
}

function deltaLabel(diff, format) {
  const sign = diff > 0 ? '+' : '';
  if (format === 'pct') return `${sign}${diff.toFixed(1)} pts`;
  if (format === 'score') return `${sign}${diff.toFixed(3)}`;
  return `${sign}${Math.round(diff).toLocaleString()}`;
}

function Delta({ current, baseline, higherIsBetter, format }) {
  if (current == null || baseline == null || Number.isNaN(current)) return null;
  const diff = current - baseline;
  const negligible = format === 'score' ? Math.abs(diff) < 0.001 : Math.abs(diff) < 0.05;
  let cls = 'text-gray-400 bg-gray-50';
  if (!negligible) {
    const improved = higherIsBetter ? diff > 0 : diff < 0;
    cls = improved ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50';
  }
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded tabular-nums ${cls}`}>
      {negligible ? '±0' : deltaLabel(diff, format)}
    </span>
  );
}

// --- tiles ----------------------------------------------------------------
function MetricTile({ label, current, baseline, format, higherIsBetter, sparkline, color }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-gray-900 tabular-nums">
          {fmt(current, format)}
        </span>
        <Delta current={current} baseline={baseline} higherIsBetter={higherIsBetter} format={format} />
      </div>
      <div className="mt-auto pt-3 flex items-end justify-between">
        <span className="text-xs text-gray-400">
          baseline <span className="tabular-nums text-gray-500">{fmt(baseline, format)}</span>
        </span>
        <Sparkline values={sparkline} color={color || '#6366f1'} />
      </div>
    </div>
  );
}

// ER precision/recall/F1 from the eval (#400/#421), with provenance badge.
function ErEvalTile({ precision, recall, f1, source, sparkline }) {
  const live = precision != null || recall != null || f1 != null;
  const golden = source === 'golden';
  return (
    <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-gray-500">ER precision · recall · F1</div>
        {live && source && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${golden ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'}`}>
            {golden ? 'human-graded (golden)' : `${source}`}
          </span>
        )}
      </div>
      {live ? (
        <div className="mt-2 flex items-end gap-6">
          {[['Precision', precision], ['Recall', recall], ['F1', f1]].map(([k, v]) => (
            <div key={k}>
              <div className="text-2xl font-semibold text-gray-900 tabular-nums">{v != null ? v.toFixed(3) : '—'}</div>
              <div className="text-xs text-gray-400">{k}</div>
            </div>
          ))}
          <div className="ml-auto self-end"><Sparkline values={sparkline} color="#10b981" /></div>
        </div>
      ) : (
        <div className="mt-2 text-2xl font-semibold text-gray-300">pending eval (#400)</div>
      )}
    </div>
  );
}

function StubTile({ label, baseline, format, pendingIssue }) {
  return (
    <div className="bg-white rounded-lg border border-dashed border-gray-200 p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-gray-500">{label}</div>
        <a
          href={`${ISSUE_URL}/${pendingIssue.replace('#', '')}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded hover:bg-amber-100"
        >
          pending {pendingIssue}
        </a>
      </div>
      <div className="mt-1 text-2xl font-semibold text-gray-300 tabular-nums">—</div>
      <div className="mt-auto pt-3 text-xs text-gray-400">
        baseline <span className="tabular-nums text-gray-500">{fmt(baseline, format)}</span>
      </div>
    </div>
  );
}

// --- Work-rollup readiness (issue #403 comment · keystone #396 flag) ------
const READINESS = {
  latent: { label: 'Latent', cls: 'text-gray-600 bg-gray-100' },
  emerging: { label: 'Emerging', cls: 'text-amber-700 bg-amber-100' },
  ready: { label: 'Ready', cls: 'text-green-700 bg-green-100' },
};

function MiniStat({ label, value }) {
  return (
    <div className="bg-gray-50 rounded p-3">
      <div className="text-xl font-semibold text-gray-900 tabular-nums">
        {value == null ? '—' : Number(value).toLocaleString()}
      </div>
      <div className="mt-0.5 text-xs text-gray-500">{label}</div>
    </div>
  );
}

function WorkRollupPanel({ query }) {
  const d = query.data;
  const unavailable = query.isError || (d && d.available === false);

  // Endpoint ships live after the next backend deploy — degrade gracefully.
  if (query.isLoading || unavailable) {
    return (
      <div className="mb-6 bg-white rounded-lg border border-dashed border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">Work-rollup readiness</h2>
          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
            {query.isLoading ? 'loading…' : 'awaiting deploy'}
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          “Is it time to flip <code>WORK_LEVEL_CONSENSUS</code>?” — live once
          <code> /metrics/work-rollup</code> deploys.
        </p>
      </div>
    );
  }

  const r = READINESS[d.readiness] || { label: d.readiness || 'Unknown', cls: 'text-gray-600 bg-gray-100' };
  const curation = d.curation_signal || {};
  const delta = d.rollup_delta || {};
  const flag = d.flag || {};

  return (
    <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-gray-700">Work-rollup readiness</h2>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${r.cls}`}>{r.label}</span>
        </div>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            flag.enabled ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'
          }`}
        >
          {flag.name || 'WORK_LEVEL_CONSENSUS'} {flag.enabled ? 'ON' : 'OFF'}
        </span>
      </div>

      {d.message && <p className="mt-2 text-sm text-gray-600">{d.message}</p>}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <MiniStat label="Works with 2+ curated editions" value={curation.works_with_2plus_editions_curated} />
        <MiniStat label="Ranking merges if flipped (delta)" value={delta.ranked_delta} />
        <MiniStat label="Representatives changed" value={delta.representatives_changed} />
      </div>
    </div>
  );
}

// --- data extraction (defensive — backend shapes may vary) ----------------
function numberOrNull(...candidates) {
  for (const c of candidates) {
    const n = typeof c === 'string' ? parseFloat(c) : c;
    if (typeof n === 'number' && !Number.isNaN(n)) return n;
  }
  return null;
}

export default function ScorecardPage() {
  const quality = useQualitySummary();
  const seed = useSeedStatus();
  const dedup = useDeduplicationEffectiveness();
  const trends = useQualityTrends();
  const workRollup = useWorkRollup();
  const history = useScorecardHistory();

  // Weekly scorecard snapshots (#415/#418) — er_* eval metrics + fragmentation trend.
  const snapshots = history.data?.snapshots || [];
  const latestSnap = snapshots[snapshots.length - 1] || {};
  const snapMetrics = latestSnap.metrics || {};
  const erPrecision = numberOrNull(snapMetrics.er_precision);
  const erRecall = numberOrNull(snapMetrics.er_recall);
  const erF1 = numberOrNull(snapMetrics.er_f1);
  const erSource = snapMetrics.er_eval_source;
  const erF1Trend = snapshots.map(s => numberOrNull(s.metrics?.er_f1)).filter(v => v != null);
  const fragmentationPct = numberOrNull(latestSnap.fragmentation_pct);
  const fragmentationTrend = snapshots.map(s => numberOrNull(s.fragmentation_pct)).filter(v => v != null);
  const editionsLinked = numberOrNull(snapMetrics.editions_linked);

  const overall = quality.data?.overall || {};
  const distribution = quality.data?.distribution || [];
  const seedData = seed.data || {};
  const dedupData = dedup.data || {};

  // Registry size
  const registryThings = numberOrNull(
    seedData.total_things,
    overall.total_things,
  );

  // Canonical-ID coverage (any) — backend key not yet firm; try a few shapes.
  const canonicalAnyPct = numberOrNull(
    dedupData.canonical_id_coverage_pct,
    dedupData.canonical_coverage_pct,
    dedupData.coverage_pct,
    dedupData.canonical_id_any_pct,
  );

  // Extraction quality average (0..1)
  const extractionAvg = numberOrNull(overall.avg_quality);

  // Low-quality tail (% below 0.5) — derive from the quality distribution.
  const totalForTail = numberOrNull(overall.total_things);
  const lowQualityCount = distribution
    .filter(t => t.quality_tier === 'poor' || t.quality_tier === 'unusable')
    .reduce((s, t) => s + (parseInt(t.count) || 0), 0);
  const lowQualityPct =
    totalForTail && totalForTail > 0 ? (lowQualityCount / totalForTail) * 100 : null;

  // Trend sparklines (best-effort against the quality-trends shape).
  const trendRows = [...(trends.data?.trends || trends.data?.daily || [])].sort(
    (a, b) => new Date(a.day || a.date) - new Date(b.day || b.date),
  );
  const qualityTrend = trendRows
    .map(r => numberOrNull(r.avg_quality, r.avg))
    .filter(v => v != null);
  const lowQualityTrend = trendRows
    .map(r => numberOrNull(r.low_quality_pct, r.below_threshold_pct))
    .filter(v => v != null);

  const isLoading = quality.isLoading && seed.isLoading;
  const liveError = quality.error || seed.error;

  return (
    <>
      <PageHeader
        title="ER/KG Scorecard"
        description={`Measuring the entity-resolution epic (#395) against the frozen ${BASELINE_DATE} baseline — baseline · current · delta · trend.`}
      />

      <div className="mb-4 p-3 rounded border border-indigo-100 bg-indigo-50 text-xs text-indigo-800">
        Live tiles wire the existing <code>/metrics/*</code> endpoints; pending tiles are stubbed
        against their child issue. Trends render from live endpoints today — weekly-snapshot
        persistence (for full historical trends) is a backend follow-up to #403.
      </div>

      {liveError && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-xs text-red-700">
          Some live metrics failed to load. Showing what's available.
        </div>
      )}

      <WorkRollupPanel query={workRollup} />

      {/* Live metrics */}
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
        Live {isLoading && <span className="text-gray-300 normal-case">· loading…</span>}
      </h2>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricTile
          label="Registry · Things"
          current={registryThings}
          baseline={BASELINE.registryThings}
          format="count"
          higherIsBetter
          color="#6366f1"
        />
        <MetricTile
          label="Canonical-ID coverage (any)"
          current={canonicalAnyPct}
          baseline={BASELINE.canonicalIdAnyPct}
          format="pct"
          higherIsBetter
          color="#10b981"
        />
        <MetricTile
          label="Extraction quality (avg)"
          current={extractionAvg}
          baseline={BASELINE.extractionQualityAvg}
          format="score"
          higherIsBetter
          sparkline={qualityTrend}
          color="#10b981"
        />
        <MetricTile
          label="Low-quality tail (< 0.5)"
          current={lowQualityPct}
          baseline={BASELINE.extractionLowQualityPct}
          format="pct"
          higherIsBetter={false}
          sparkline={lowQualityTrend}
          color="#f59e0b"
        />
      </div>

      {/* Entity resolution — live from the eval (#421) + weekly snapshots (#415/#418) */}
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Entity resolution</h2>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <ErEvalTile precision={erPrecision} recall={erRecall} f1={erF1} source={erSource} sparkline={erF1Trend} />
        <MetricTile
          label="Edition fragmentation rate"
          current={fragmentationPct}
          baseline={BASELINE.editionFragmentationBooksPct}
          format="pct"
          higherIsBetter={false}
          sparkline={fragmentationTrend}
          color="#f59e0b"
        />
        <MetricTile
          label="Editions linked to a Work"
          current={editionsLinked}
          baseline={null}
          format="count"
          higherIsBetter
          color="#6366f1"
        />
      </div>

      {/* Pending backend */}
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
        Pending backend
      </h2>
      <div className="grid grid-cols-4 gap-4">
        <StubTile
          label="Semantic recall@K"
          baseline={null}
          format="score"
          pendingIssue="#400"
        />
        <StubTile
          label="Series · avg size"
          baseline={BASELINE.seriesAvgSize}
          format="score"
          pendingIssue="#396"
        />
      </div>
    </>
  );
}
