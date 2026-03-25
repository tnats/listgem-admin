import StatCard from '../../components/StatCard';
import { useConsensusAnalytics } from '../../api/hooks';

export default function ConsensusHealth() {
  const { data, isLoading } = useConsensusAnalytics();

  if (isLoading) return <div className="text-sm text-gray-500">Loading...</div>;

  const types = data?.types || [];
  const sparseTypes = data?.sparse_types || [];
  const rankChanges = data?.recent_rank_changes || [];

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Types" value={data?.total_types} />
        <StatCard
          label="Strong Types"
          value={data?.strong_types}
          detail="10+ lists"
        />
        <StatCard
          label="Sparse Types"
          value={data?.sparse_types_count}
          detail="< 10 lists"
        />
        <StatCard
          label="Coverage"
          value={data?.coverage_pct ? `${data.coverage_pct}%` : '—'}
          detail="types with meaningful rankings"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Type Coverage Table */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Type Coverage</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left pb-2">Type</th>
                <th className="text-right pb-2">Things</th>
                <th className="text-right pb-2">Lists</th>
                <th className="text-right pb-2">Avg Usage</th>
              </tr>
            </thead>
            <tbody>
              {types.map(t => (
                <tr key={t.type} className="border-t border-gray-50">
                  <td className="py-1 text-gray-600">{t.type}</td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">{t.thing_count}</td>
                  <td className="py-1 text-right tabular-nums">
                    <span className={parseInt(t.list_count) < 10 ? 'text-orange-500' : 'text-gray-500'}>
                      {t.list_count}
                    </span>
                  </td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">{t.avg_usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sparse Types */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Sparse Types ({sparseTypes.length})
          </h2>
          <p className="text-xs text-gray-400 mb-3">Types with fewer than 10 lists — rankings may not be meaningful.</p>
          {sparseTypes.length === 0 ? (
            <div className="text-xs text-green-600">All types have sufficient coverage</div>
          ) : (
            <div className="space-y-1">
              {sparseTypes.map(t => (
                <div key={t.type} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{t.type}</span>
                  <span className="text-orange-500 tabular-nums">{t.list_count} lists</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Rank Changes */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Recent Rank Changes (30 days)</h2>
        {rankChanges.length === 0 ? (
          <div className="text-xs text-gray-400">No rank history data yet. Rankings are recorded periodically.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left pb-2">Thing</th>
                <th className="text-left pb-2">Window</th>
                <th className="text-right pb-2">Rank</th>
                <th className="text-right pb-2">Score</th>
                <th className="text-left pb-2">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {rankChanges.map((r, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="py-1 text-gray-600 truncate max-w-[200px]">{r.thing_id}</td>
                  <td className="py-1 text-gray-400">{r.time_window}</td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">#{r.rank_in_type}</td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">
                    {parseFloat(r.bayesian_score || r.consensus_score)?.toFixed(2)}
                  </td>
                  <td className="py-1 text-gray-400">{new Date(r.recorded_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
