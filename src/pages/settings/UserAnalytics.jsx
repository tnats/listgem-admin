import StatCard from '../../components/StatCard';
import { useUserAnalytics } from '../../api/hooks';

export default function UserAnalytics() {
  const { data, isLoading } = useUserAnalytics();

  if (isLoading) return <div className="text-sm text-gray-500">Loading...</div>;

  const funnel = data?.funnel || {};
  const trend = data?.signup_trend || [];
  const curators = data?.top_curators || [];
  const geo = data?.geographic || [];

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value={data?.total?.toLocaleString()} />
        <StatCard label="Last 7 Days" value={data?.last_7d?.toLocaleString()} />
        <StatCard label="Last 30 Days" value={data?.last_30d?.toLocaleString()} />
        <StatCard
          label="With Lists"
          value={parseInt(funnel.users_with_lists)?.toLocaleString() || '—'}
          detail={`of ${parseInt(funnel.total_users)?.toLocaleString() || '?'} total`}
        />
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">User Funnel</h2>
        <div className="flex gap-2 items-end h-24">
          {[
            { label: 'Signed up', value: parseInt(funnel.total_users) || 0 },
            { label: 'Created a list', value: parseInt(funnel.users_with_lists) || 0 },
            { label: '5+ items in a list', value: parseInt(funnel.users_with_5_items) || 0 },
            { label: '3+ lists', value: parseInt(funnel.users_with_3_lists) || 0 },
          ].map((step, i) => {
            const max = parseInt(funnel.total_users) || 1;
            const pct = (step.value / max) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="text-xs text-gray-500 tabular-nums mb-1">{step.value}</div>
                <div
                  className="w-full bg-indigo-400 rounded-t"
                  style={{ height: `${Math.max(pct * 0.8, 4)}px` }}
                />
                <div className="text-[10px] text-gray-400 mt-1 text-center">{step.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Signup Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Daily Signups (30 days)</h2>
          {trend.length === 0 ? (
            <div className="text-xs text-gray-400">No data</div>
          ) : (
            <div className="flex items-end gap-px h-20">
              {trend.map((d, i) => {
                const max = Math.max(...trend.map(t => parseInt(t.count)), 1);
                const val = parseInt(d.count);
                return (
                  <div
                    key={i}
                    className="flex-1 bg-indigo-400 rounded-t min-h-[2px]"
                    style={{ height: `${(val / max) * 72}px` }}
                    title={`${new Date(d.date).toLocaleDateString()}: ${val}`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Geographic Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-64 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Geographic Distribution</h2>
          {geo.length === 0 ? (
            <div className="text-xs text-gray-400">No location data</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase">
                  <th className="text-left pb-2">City</th>
                  <th className="text-left pb-2">State</th>
                  <th className="text-left pb-2">Country</th>
                  <th className="text-right pb-2">Users</th>
                </tr>
              </thead>
              <tbody>
                {geo.map((g, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="py-1 text-gray-600">{g.city}</td>
                    <td className="py-1 text-gray-400">{g.state}</td>
                    <td className="py-1 text-gray-400">{g.country}</td>
                    <td className="py-1 text-right text-gray-500 tabular-nums">{g.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Top Curators */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Top Curators</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 uppercase">
              <th className="text-left pb-2">Curator</th>
              <th className="text-right pb-2">Lists</th>
              <th className="text-right pb-2">Items</th>
              <th className="text-right pb-2">Followers</th>
              <th className="text-left pb-2">Location</th>
            </tr>
          </thead>
          <tbody>
            {curators.map(c => (
              <tr key={c.user_id} className="border-t border-gray-50">
                <td className="py-1.5">
                  <div className="flex items-center gap-2">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-200" />
                    )}
                    <span className="text-gray-700 font-medium">{c.display_name || c.username}</span>
                  </div>
                </td>
                <td className="py-1.5 text-right text-gray-500 tabular-nums">{c.list_count}</td>
                <td className="py-1.5 text-right text-gray-500 tabular-nums">{c.total_items}</td>
                <td className="py-1.5 text-right text-gray-500 tabular-nums">{c.follower_count}</td>
                <td className="py-1.5 text-gray-400">{[c.city, c.country].filter(Boolean).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
