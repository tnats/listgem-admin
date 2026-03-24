import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useWorkerHealth, useQueueStats, useCrawlAnalytics, useAlerts } from '../../api/hooks';

function formatUptime(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function WorkerPage() {
  const { data: health, isLoading: healthLoading } = useWorkerHealth();
  const { data: queue, isLoading: queueLoading } = useQueueStats();
  const { data: crawls } = useCrawlAnalytics();
  const { data: alerts } = useAlerts();

  if (healthLoading) return <div className="text-sm text-gray-500">Loading...</div>;

  const worker = health?.worker || {};
  const metrics = health?.metrics || {};
  const status = health?.status || 'unknown';
  const daily = crawls?.daily || [];
  const alertState = alerts?.alertState || {};
  const channels = alerts?.channels || {};

  return (
    <>
      <PageHeader title="Worker Health" description="Queue processing, job metrics, and alert status" />

      {/* Worker Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-1">Status</div>
              <StatusBadge status={status} />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Version</div>
              <span className="text-sm text-gray-700 font-mono">{worker.version || '—'}</span>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Uptime</div>
              <span className="text-sm text-gray-700">{formatUptime(worker.uptime)}</span>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Last Heartbeat</div>
              <span className="text-sm text-gray-700">{worker.heartbeatAge || '—'}</span>
            </div>
          </div>
          {health?.currentJob && (
            <div className="text-right">
              <div className="text-xs text-gray-400 mb-1">Current Job</div>
              <span className="text-sm text-gray-600 truncate max-w-xs block">
                {health.currentJob.url || health.currentJob.id}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Job Metrics + Queue Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Jobs Processed" value={metrics.jobsProcessed?.toLocaleString() ?? '—'} />
        <StatCard label="Succeeded" value={metrics.jobsSucceeded?.toLocaleString() ?? '—'} />
        <StatCard label="Failed" value={metrics.jobsFailed?.toLocaleString() ?? '—'} />
        <StatCard label="Success Rate" value={metrics.successRate || '—'} />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Queue: Waiting"
          value={queueLoading ? '...' : queue?.waiting ?? '—'}
        />
        <StatCard
          label="Queue: Active"
          value={queueLoading ? '...' : queue?.active ?? '—'}
        />
        <StatCard
          label="Queue: Completed"
          value={queueLoading ? '...' : queue?.completed?.toLocaleString() ?? '—'}
        />
        <StatCard
          label="Queue: Failed"
          value={queueLoading ? '...' : queue?.failed?.toLocaleString() ?? '—'}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Daily Crawl Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Daily Crawl Activity</h2>
          {daily.length === 0 ? (
            <div className="text-xs text-gray-400">No data</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase">
                  <th className="text-left pb-2">Date</th>
                  <th className="text-right pb-2">Total</th>
                  <th className="text-right pb-2">Success</th>
                  <th className="text-right pb-2">Failed</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((d, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="py-1 text-gray-600">
                      {new Date(d.date).toLocaleDateString()}
                    </td>
                    <td className="py-1 text-right text-gray-500 tabular-nums">{d.total}</td>
                    <td className="py-1 text-right text-green-600 tabular-nums">{d.succeeded}</td>
                    <td className="py-1 text-right text-red-500 tabular-nums">{d.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Alert Channels */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Alert Channels</h2>
          <div className="space-y-2">
            {[
              { name: 'Slack', configured: channels.slack },
              { name: 'Email', configured: channels.email },
              { name: 'Webhook', configured: channels.webhook },
            ].map(ch => (
              <div key={ch.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{ch.name}</span>
                <span className={ch.configured ? 'text-green-600' : 'text-gray-400'}>
                  {ch.configured ? 'Configured' : 'Not configured'}
                </span>
              </div>
            ))}
          </div>

          {alertState.activeAlerts && Object.keys(alertState.activeAlerts).length > 0 && (
            <>
              <h2 className="text-sm font-medium text-gray-700 mt-4 mb-2">Active Alerts</h2>
              {Object.entries(alertState.activeAlerts).map(([type, info]) => (
                <div key={type} className="p-2 bg-red-50 rounded text-xs text-red-700 mb-1">
                  <span className="font-medium">{type}</span>: {info.message || 'Active'}
                </div>
              ))}
            </>
          )}

          {(!alertState.activeAlerts || Object.keys(alertState.activeAlerts).length === 0) && (
            <div className="mt-4 text-xs text-green-600">No active alerts</div>
          )}
        </div>
      </div>
    </>
  );
}
