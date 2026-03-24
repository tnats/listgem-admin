import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { useAnalytics } from '../../api/hooks';

export default function DashboardPage() {
  const { data, isLoading } = useAnalytics();

  if (isLoading) return <div className="text-sm text-gray-500">Loading...</div>;

  return (
    <>
      <PageHeader title="Dashboard" description="Platform overview" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Things" value={data?.total_things?.toLocaleString()} />
        <StatCard label="Total Lists" value={data?.total_lists?.toLocaleString()} />
        <StatCard label="Total Users" value={data?.total_users?.toLocaleString()} />
        <StatCard
          label="Types"
          value={data?.type_distribution?.length}
          detail="active types"
        />
      </div>

      {data?.type_distribution && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Things by Type (top 15)</h2>
          <div className="space-y-1.5">
            {data.type_distribution.slice(0, 15).map(row => (
              <div key={row.type} className="flex items-center text-sm">
                <span className="w-32 text-gray-600 truncate">{row.type}</span>
                <div className="flex-1 mx-3 h-4 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded"
                    style={{ width: `${(row.count / data.type_distribution[0].count) * 100}%` }}
                  />
                </div>
                <span className="w-12 text-right text-gray-500 tabular-nums">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
