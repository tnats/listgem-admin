import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { useImageQuality } from '../../api/hooks';

function coverageColor(value) {
  const pct = parseFloat(value);
  if (isNaN(pct)) return 'text-gray-500';
  if (pct >= 90) return 'text-green-600';
  if (pct >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

function coverageBg(value) {
  const pct = parseFloat(value);
  if (isNaN(pct)) return 'bg-gray-100';
  if (pct >= 90) return 'bg-green-500';
  if (pct >= 70) return 'bg-yellow-500';
  return 'bg-red-500';
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ImageQualityPage() {
  const { data, isLoading, error } = useImageQuality();

  if (isLoading) return <div className="text-sm text-gray-500">Loading...</div>;
  if (error) return <div className="text-sm text-red-500">Failed to load image quality data.</div>;

  const totalThings = data?.total_things ?? 0;
  const withImage = data?.with_image ?? 0;
  const missingImage = data?.missing_image ?? 0;
  const imageCoverage = data?.image_coverage ?? '—';
  const rankedMissing = data?.ranked_missing_image ?? 0;
  const byType = [...(data?.by_type || [])].sort(
    (a, b) => (b.missing ?? 0) - (a.missing ?? 0),
  );

  const coveragePct = parseFloat(imageCoverage) || 0;

  // Image rot + Commons normalization (#424 / #474). broken_image starts at 0
  // and fills in as the daily dead-link sweep runs; commons_normalized_pct is a
  // "done" bar (100% today).
  const brokenImage = data?.broken_image ?? 0;
  const lastDeadScan = data?.last_dead_link_scan_at;
  const commonsTotal = data?.commons_total;
  const commonsPct = data?.commons_normalized_pct;
  const hasCommons = commonsPct != null;

  return (
    <>
      <PageHeader
        title="Image Quality"
        description="Image coverage across the registry — missing images, ranked gaps, broken-image rot, and Commons normalization"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Image Coverage"
          value={imageCoverage !== '—' ? imageCoverage : '—'}
          detail={`${withImage.toLocaleString()} / ${totalThings.toLocaleString()} things`}
        />
        <StatCard
          label="Missing Images"
          value={missingImage.toLocaleString()}
          detail="Total things without an image"
        />
        <StatCard
          label="Ranked Items Missing"
          value={rankedMissing.toLocaleString()}
          detail="Visible on consensus pages"
        />
        <StatCard
          label="Broken Images"
          value={brokenImage.toLocaleString()}
          detail={lastDeadScan ? `dead links · scanned ${fmtDate(lastDeadScan)}` : 'dead links · fills in as the sweep runs'}
        />
      </div>

      {/* Commons normalization (#424) */}
      {hasCommons && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-700">
              Commons thumbnail normalization
              {commonsTotal != null && <span className="text-gray-400 font-normal"> · {Number(commonsTotal).toLocaleString()} URLs</span>}
            </h2>
            {parseFloat(commonsPct) >= 100 && (
              <span className="text-xs font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">done</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
              <div className={`h-full rounded ${coverageBg(commonsPct)}`} style={{ width: `${Math.min(parseFloat(commonsPct) || 0, 100)}%` }} />
            </div>
            <span className={`text-sm font-medium tabular-nums ${coverageColor(commonsPct)}`}>
              {typeof commonsPct === 'number' ? `${commonsPct.toFixed(1)}%` : commonsPct}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-400">Wikimedia Commons originals rewritten to <code>https</code> + a width param (CDN thumbnail) — page-weight win on card tiles.</p>
        </div>
      )}

      {/* Coverage bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Overall Coverage</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
            <div
              className={`h-full rounded ${coverageBg(coveragePct)}`}
              style={{ width: `${Math.min(coveragePct, 100)}%` }}
            />
          </div>
          <span className={`text-sm font-medium tabular-nums ${coverageColor(coveragePct)}`}>
            {imageCoverage}
          </span>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-400">
          <span>{withImage.toLocaleString()} with image</span>
          <span>{missingImage.toLocaleString()} missing</span>
        </div>
      </div>

      {/* By-Type Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Coverage by Type</h2>
        {byType.length === 0 ? (
          <div className="text-xs text-gray-400">No data available</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase">
                  <th className="text-left pb-2">Type</th>
                  <th className="text-right pb-2">Total</th>
                  <th className="text-right pb-2">Missing</th>
                  <th className="text-right pb-2">Broken</th>
                  <th className="text-right pb-2">Coverage</th>
                  <th className="pb-2 pl-4 w-32"></th>
                </tr>
              </thead>
              <tbody>
                {byType.map(t => {
                  const pct = parseFloat(t.coverage) || 0;
                  return (
                    <tr key={t.type} className="border-t border-gray-50">
                      <td className="py-1.5 text-gray-600 font-medium">{t.type}</td>
                      <td className="py-1.5 text-right text-gray-500 tabular-nums">{t.total}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        <span className={t.missing > 0 ? 'text-red-500' : 'text-gray-400'}>
                          {t.missing}
                        </span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        <span className={t.broken > 0 ? 'text-amber-600' : 'text-gray-300'}>
                          {t.broken ?? 0}
                        </span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        <span className={coverageColor(pct)}>{t.coverage}</span>
                      </td>
                      <td className="py-1.5 pl-4">
                        <div className="h-2 bg-gray-100 rounded overflow-hidden">
                          <div
                            className={`h-full rounded ${coverageBg(pct)}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sweep Activity */}
      {data?.sweep && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Image Sweep Activity</h2>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-gray-400">Last Sweep</span>
              <div className="mt-0.5 text-gray-700">
                {data.sweep.last_run
                  ? new Date(data.sweep.last_run).toLocaleString()
                  : '—'}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Items Enqueued</span>
              <div className="mt-0.5 text-gray-700 tabular-nums">
                {data.sweep.enqueued?.toLocaleString() ?? '—'}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Duration</span>
              <div className="mt-0.5 text-gray-700 tabular-nums">
                {data.sweep.duration_ms != null
                  ? `${(data.sweep.duration_ms / 1000).toFixed(1)}s`
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
