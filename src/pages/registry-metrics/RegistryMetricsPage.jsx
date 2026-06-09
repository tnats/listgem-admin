import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { useRegistrySearch, useResolutionMetrics } from '../../api/hooks';

function rateColor(pct) {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function rateBg(pct) {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

function Sparkline({ values, color = '#6366f1', width = 120, height = 28 }) {
  if (!values || values.length < 2) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function RegistryMetricsPage() {
  const search = useRegistrySearch();
  const resolution = useResolutionMetrics();

  const isLoading = search.isLoading || resolution.isLoading;
  const error = search.error || resolution.error;

  if (isLoading) return <div className="text-sm text-gray-500">Loading...</div>;
  if (error) return <div className="text-sm text-red-500">Failed to load registry metrics.</div>;

  const searchData = search.data || {};
  const resData = resolution.data || {};

  const coverage = searchData.coverage;
  const hitRatePct = coverage?.hit_rate_pct ?? 0;
  const totalCrawls = coverage?.total_crawls ?? 0;
  const registryMatches = coverage?.registry_matches ?? 0;
  const avgTimingMs = coverage?.avg_timing_ms ?? 0;

  const cacheCoverage = resData.url_cache_coverage;
  const cachePct = cacheCoverage?.coverage_pct ?? 0;
  const thingsWithUrls = cacheCoverage?.things_with_urls ?? 0;
  const totalThings = cacheCoverage?.total_things ?? 0;
  const totalCachedUrls = resData.total_cached_urls ?? 0;

  const stageBreakdown = [...(searchData.stage_breakdown || [])].sort(
    (a, b) => (b.count ?? 0) - (a.count ?? 0),
  );
  const stageTotal = stageBreakdown.reduce((sum, s) => sum + (parseInt(s.count) || 0), 0);

  const timing = searchData.timing || [];
  const typeBreakdown = searchData.type_breakdown || [];

  const dailyVolume = [...(searchData.daily_volume || [])].sort(
    (a, b) => new Date(a.day) - new Date(b.day),
  );
  const dailyHitRates = dailyVolume.map(d => parseFloat(d.hit_rate) * 100);
  const dailyEvents = dailyVolume.map(d => parseInt(d.total_events) || 0);

  const dailyTrend = [...(resData.daily_trend || [])].sort(
    (a, b) => new Date(a.day) - new Date(b.day),
  );
  const dailyCached = dailyTrend.map(d => parseInt(d.urls_cached) || 0);

  const byPipeline = resData.by_pipeline || [];
  const pipelineTotal = byPipeline.reduce((sum, p) => sum + (parseInt(p.count) || 0), 0);

  const note = searchData.note || resData.note;

  return (
    <>
      <PageHeader
        title="Registry Metrics"
        description="Registry resolution hit rates, search stage breakdown, and URL cache coverage"
      />

      {note && (
        <div className="mb-4 p-3 rounded border border-yellow-200 bg-yellow-50 text-xs text-yellow-800">
          {note}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Registry Hit Rate"
          value={coverage ? `${hitRatePct}%` : '—'}
          detail={`${registryMatches.toLocaleString()} / ${totalCrawls.toLocaleString()} (30d)`}
        />
        <StatCard
          label="URL Cache Coverage"
          value={cacheCoverage ? `${cachePct}%` : '—'}
          detail={`${thingsWithUrls.toLocaleString()} / ${totalThings.toLocaleString()} things`}
        />
        <StatCard
          label="Total Cached URLs"
          value={totalCachedUrls.toLocaleString()}
          detail="All-time"
        />
        <StatCard
          label="Avg Resolution Time"
          value={`${avgTimingMs}ms`}
          detail="30-day average"
        />
      </div>

      {/* Hit rate bar + daily sparkline */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Registry Hit Rate</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
              <div
                className={`h-full rounded ${rateBg(hitRatePct)}`}
                style={{ width: `${Math.min(hitRatePct, 100)}%` }}
              />
            </div>
            <span className={`text-sm font-medium tabular-nums ${rateColor(hitRatePct)}`}>
              {hitRatePct}%
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-400">14-day hit rate trend</span>
            <Sparkline values={dailyHitRates} color="#6366f1" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">URL Cache Coverage</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
              <div
                className={`h-full rounded ${rateBg(cachePct)}`}
                style={{ width: `${Math.min(cachePct, 100)}%` }}
              />
            </div>
            <span className={`text-sm font-medium tabular-nums ${rateColor(cachePct)}`}>
              {cachePct}%
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-400">14-day URLs cached</span>
            <Sparkline values={dailyCached} color="#10b981" />
          </div>
        </div>
      </div>

      {/* Search stage funnel */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Search Stage Breakdown (30d)</h2>
        {stageBreakdown.length === 0 ? (
          <div className="text-xs text-gray-400">No data available</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left pb-2">Stage</th>
                <th className="text-left pb-2">Method</th>
                <th className="text-right pb-2">Count</th>
                <th className="text-right pb-2">Avg Conf.</th>
                <th className="text-right pb-2">Avg ms</th>
                <th className="pb-2 pl-4 w-40"></th>
              </tr>
            </thead>
            <tbody>
              {stageBreakdown.map((s, idx) => {
                const count = parseInt(s.count) || 0;
                const sharePct = stageTotal > 0 ? (count / stageTotal) * 100 : 0;
                const isMatch = s.resolution_stage === 'registry_match';
                return (
                  <tr key={`${s.resolution_stage}-${s.resolution_method}-${idx}`} className="border-t border-gray-50">
                    <td className="py-1.5 text-gray-600 font-medium">
                      <span className={isMatch ? 'text-green-600' : 'text-gray-600'}>
                        {s.resolution_stage}
                      </span>
                    </td>
                    <td className="py-1.5 text-gray-500">{s.resolution_method || '—'}</td>
                    <td className="py-1.5 text-right text-gray-700 tabular-nums">{count.toLocaleString()}</td>
                    <td className="py-1.5 text-right text-gray-500 tabular-nums">{s.avg_confidence ?? '—'}</td>
                    <td className="py-1.5 text-right text-gray-500 tabular-nums">{s.avg_timing_ms ?? '—'}</td>
                    <td className="py-1.5 pl-4">
                      <div className="h-2 bg-gray-100 rounded overflow-hidden">
                        <div
                          className={`h-full rounded ${isMatch ? 'bg-green-500' : 'bg-gray-400'}`}
                          style={{ width: `${Math.min(sharePct, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Timing + Type breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Timing by Method (30d)</h2>
          {timing.length === 0 ? (
            <div className="text-xs text-gray-400">No data available</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase">
                  <th className="text-left pb-2">Method</th>
                  <th className="text-right pb-2">Avg ms</th>
                  <th className="text-right pb-2">p95 ms</th>
                  <th className="text-right pb-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {timing.map((t, idx) => (
                  <tr key={`${t.resolution_method}-${idx}`} className="border-t border-gray-50">
                    <td className="py-1.5 text-gray-600">{t.resolution_method}</td>
                    <td className="py-1.5 text-right tabular-nums">{t.avg_ms ?? '—'}</td>
                    <td className="py-1.5 text-right tabular-nums">{t.p95_ms ?? '—'}</td>
                    <td className="py-1.5 text-right text-gray-500 tabular-nums">
                      {parseInt(t.count || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Hit Rate by Type (30d)</h2>
          {typeBreakdown.length === 0 ? (
            <div className="text-xs text-gray-400">No data available</div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 uppercase">
                    <th className="text-left pb-2">Type</th>
                    <th className="text-right pb-2">Total</th>
                    <th className="text-right pb-2">Matches</th>
                    <th className="text-right pb-2">Hit Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {typeBreakdown.map((t, idx) => {
                    const pct = parseFloat(t.hit_rate) * 100;
                    return (
                      <tr key={`${t.thing_type}-${idx}`} className="border-t border-gray-50">
                        <td className="py-1.5 text-gray-600 font-medium">{t.thing_type}</td>
                        <td className="py-1.5 text-right text-gray-500 tabular-nums">
                          {parseInt(t.total || 0).toLocaleString()}
                        </td>
                        <td className="py-1.5 text-right text-gray-500 tabular-nums">
                          {parseInt(t.matches || 0).toLocaleString()}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          <span className={rateColor(pct)}>{pct.toFixed(1)}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Daily volume table */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Daily Volume (14d)</h2>
        {dailyVolume.length === 0 ? (
          <div className="text-xs text-gray-400">No data available</div>
        ) : (
          <div className="flex items-end gap-1 h-24 mb-3">
            {dailyVolume.map(d => {
              const maxEvents = Math.max(...dailyEvents, 1);
              const heightPct = (parseInt(d.total_events) / maxEvents) * 100;
              const hitPct = parseFloat(d.hit_rate) * 100;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center justify-end group relative">
                  <div
                    className={`w-full rounded-t ${rateBg(hitPct)} opacity-80`}
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  />
                  <div className="absolute bottom-full mb-1 hidden group-hover:block text-xs bg-gray-900 text-white rounded px-2 py-1 whitespace-nowrap z-10">
                    {new Date(d.day).toLocaleDateString()}: {parseInt(d.total_events).toLocaleString()} events, {hitPct.toFixed(1)}% hit
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resolution pipeline breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">URL Cache by Pipeline</h2>
        {byPipeline.length === 0 ? (
          <div className="text-xs text-gray-400">No data available</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left pb-2">Pipeline</th>
                <th className="text-right pb-2">Count</th>
                <th className="text-right pb-2">Share</th>
                <th className="pb-2 pl-4 w-40"></th>
              </tr>
            </thead>
            <tbody>
              {byPipeline.map(p => {
                const count = parseInt(p.count) || 0;
                const sharePct = pipelineTotal > 0 ? (count / pipelineTotal) * 100 : 0;
                return (
                  <tr key={p.pipeline} className="border-t border-gray-50">
                    <td className="py-1.5 text-gray-600 font-medium">{p.pipeline}</td>
                    <td className="py-1.5 text-right text-gray-700 tabular-nums">{count.toLocaleString()}</td>
                    <td className="py-1.5 text-right text-gray-500 tabular-nums">{sharePct.toFixed(1)}%</td>
                    <td className="py-1.5 pl-4">
                      <div className="h-2 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full rounded bg-indigo-500"
                          style={{ width: `${Math.min(sharePct, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
