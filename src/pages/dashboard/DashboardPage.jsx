import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { useAnalytics, useCrawlAnalytics } from '../../api/hooks';

export default function DashboardPage() {
  const { data, isLoading, error } = useAnalytics();
  const { data: crawls } = useCrawlAnalytics();

  if (isLoading) return <div className="text-sm text-gray-500">Loading analytics...</div>;
  if (error) return <div className="text-sm text-red-500">Failed to load: {error.message}</div>;

  const types = data?.types?.distribution || [];
  const lists = data?.lists || {};
  const users = data?.users || {};
  const activity = data?.activity?.last7Days || [];
  const topThings = data?.topThings || [];
  const categories = data?.categories?.popular || [];
  const crawlSummary = crawls?.summary || {};
  const crawlDomains = crawls?.domains || [];

  return (
    <>
      <PageHeader title="Dashboard" description="Platform overview" />

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Things"
          value={types.reduce((s, t) => s + parseInt(t.count), 0).toLocaleString()}
          detail={`${types.length} active types`}
        />
        <StatCard
          label="Total Lists"
          value={lists.total?.toLocaleString()}
          detail={`${lists.public?.toLocaleString()} public`}
        />
        <StatCard
          label="Total Users"
          value={users.total?.toLocaleString()}
          detail={`${users.newLast7Days} new this week`}
        />
        <StatCard
          label="Crawl Success"
          value={crawlSummary.successRate || '—'}
          detail={`${crawlSummary.totalJobs?.toLocaleString() || 0} total jobs`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Type Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Things by Type (top 15)</h2>
          <div className="space-y-1.5">
            {types.slice(0, 15).map(row => {
              const maxCount = parseInt(types[0]?.count) || 1;
              const count = parseInt(row.count);
              return (
                <div key={row.type} className="flex items-center text-sm">
                  <span className="w-28 text-gray-600 truncate text-xs">{row.type}</span>
                  <div className="flex-1 mx-2 h-3.5 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-gray-500 tabular-nums text-xs">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity + Top Things */}
        <div className="space-y-4">
          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Activity (last 7 days)</h2>
            {activity.length === 0 ? (
              <div className="text-xs text-gray-400">No recent activity</div>
            ) : (
              <div className="flex items-end gap-1 h-16">
                {activity.map((day, i) => {
                  const max = Math.max(...activity.map(d => parseInt(d.things_added) || 0), 1);
                  const val = parseInt(day.things_added) || 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-indigo-400 rounded-t"
                        style={{ height: `${Math.max((val / max) * 48, 2)}px` }}
                        title={`${new Date(day.date).toLocaleDateString()}: ${val} things`}
                      />
                      <span className="text-[9px] text-gray-400 mt-1">
                        {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Things */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Top Things</h2>
            <div className="space-y-1">
              {topThings.slice(0, 8).map((thing, i) => (
                <div key={thing.thing_id} className="flex items-center text-xs gap-2">
                  <span className="text-gray-400 w-4 text-right">{i + 1}</span>
                  <span className="text-gray-600 flex-1 truncate">{thing.title}</span>
                  <span className="text-gray-400">{thing.type}</span>
                  <span className="text-gray-500 tabular-nums">{thing.usage_count}x</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Popular Categories */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Popular Categories</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left pb-2">Type</th>
                <th className="text-left pb-2">Category</th>
                <th className="text-right pb-2">Lists</th>
              </tr>
            </thead>
            <tbody>
              {categories.slice(0, 10).map((cat, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="py-1 text-gray-500">{cat.thing_type}</td>
                  <td className="py-1 text-gray-600">{cat.category}</td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">{cat.list_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Crawl Domains */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Top Crawl Domains</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left pb-2">Domain</th>
                <th className="text-right pb-2">Jobs</th>
                <th className="text-right pb-2">Success</th>
              </tr>
            </thead>
            <tbody>
              {crawlDomains.slice(0, 10).map((d, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="py-1 text-gray-600 truncate max-w-[180px]">{d.domain}</td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">{d.total}</td>
                  <td className="py-1 text-right text-gray-500 tabular-nums">{d.success_rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
