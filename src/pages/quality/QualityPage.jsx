import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { useQualitySummary, useQualityByType, useImageAnalytics } from '../../api/hooks';

const TIER_COLORS = {
  excellent: 'bg-green-500',
  good: 'bg-blue-500',
  acceptable: 'bg-yellow-500',
  poor: 'bg-orange-500',
  unusable: 'bg-red-500',
};

export default function QualityPage() {
  const { data: summary, isLoading } = useQualitySummary();
  const { data: byType } = useQualityByType();
  const { data: images } = useImageAnalytics();

  if (isLoading) return <div className="text-sm text-gray-500">Loading...</div>;

  const distribution = summary?.distribution || [];
  const overall = summary?.overall || {};
  const types = byType?.types || [];
  const imgSummary = images?.summary || {};
  const imgByType = images?.coverageByType || [];

  const totalThings = parseInt(overall.total_things) || 0;

  return (
    <>
      <PageHeader title="Quality Metrics" description="Data quality, image coverage, and enrichment health" />

      {/* Overall Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Things" value={totalThings.toLocaleString()} />
        <StatCard label="Avg Quality" value={parseFloat(overall.avg_quality)?.toFixed(2) || '—'} />
        <StatCard label="Avg Type Confidence" value={parseFloat(overall.avg_type_confidence)?.toFixed(2) || '—'} />
        <StatCard label="Needs Improvement" value={parseInt(overall.needs_improvement)?.toLocaleString() || '—'} />
        <StatCard
          label="Image Coverage"
          value={imgSummary.coveragePercent ? `${imgSummary.coveragePercent}%` : '—'}
          detail={`${imgSummary.withImages || 0} / ${imgSummary.totalThings || 0}`}
        />
      </div>

      {/* Quality Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Quality Distribution</h2>
        <div className="flex gap-1 h-8 rounded overflow-hidden mb-3">
          {distribution.map(tier => {
            const pct = totalThings > 0 ? (parseInt(tier.count) / totalThings) * 100 : 0;
            if (pct < 0.5) return null;
            return (
              <div
                key={tier.quality_tier}
                className={`${TIER_COLORS[tier.quality_tier] || 'bg-gray-400'} relative group`}
                style={{ width: `${pct}%` }}
                title={`${tier.quality_tier}: ${tier.count} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
        <div className="flex gap-4 text-xs">
          {distribution.map(tier => (
            <div key={tier.quality_tier} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded ${TIER_COLORS[tier.quality_tier] || 'bg-gray-400'}`} />
              <span className="text-gray-600">{tier.quality_tier}</span>
              <span className="text-gray-400">{tier.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Quality by Type */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Quality by Type</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left pb-2">Type</th>
                <th className="text-right pb-2">Count</th>
                <th className="text-right pb-2">Avg Quality</th>
                <th className="text-right pb-2">Confidence</th>
                <th className="text-right pb-2">Needs Fix</th>
              </tr>
            </thead>
            <tbody>
              {types.map(t => (
                <tr key={t.type} className="border-t border-gray-50">
                  <td className="py-1 text-gray-600">{t.type}</td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">{t.count}</td>
                  <td className="py-1 text-right tabular-nums">
                    <span className={parseFloat(t.avg_quality) < 0.5 ? 'text-red-500' : 'text-gray-500'}>
                      {parseFloat(t.avg_quality)?.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">
                    {parseFloat(t.avg_type_confidence)?.toFixed(2)}
                  </td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">{t.needs_improvement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Image Coverage by Type */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Image Coverage by Type</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left pb-2">Type</th>
                <th className="text-right pb-2">Total</th>
                <th className="text-right pb-2">Has Image</th>
                <th className="text-right pb-2">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {imgByType.map(t => (
                <tr key={t.type} className="border-t border-gray-50">
                  <td className="py-1 text-gray-600">{t.type}</td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">{t.total}</td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">{t.with_image}</td>
                  <td className="py-1 text-right tabular-nums">
                    <span className={parseFloat(t.coverage_pct) < 50 ? 'text-red-500' : 'text-gray-500'}>
                      {t.coverage_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
