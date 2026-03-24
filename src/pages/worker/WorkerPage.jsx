import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useWorkerHealth, useQueueStats } from '../../api/hooks';

export default function WorkerPage() {
  const { data: health, isLoading: healthLoading } = useWorkerHealth();
  const { data: queue, isLoading: queueLoading } = useQueueStats();

  if (healthLoading || queueLoading) return <div className="text-sm text-gray-500">Loading...</div>;

  const status = health?.status || 'unknown';

  return (
    <>
      <PageHeader title="Worker Health" description="Queue processing and worker status" />

      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-gray-600">Worker status:</span>
        <StatusBadge status={status} />
        {health?.last_heartbeat && (
          <span className="text-xs text-gray-400">
            Last heartbeat: {new Date(health.last_heartbeat).toLocaleString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Waiting" value={queue?.waiting ?? '—'} />
        <StatCard label="Active" value={queue?.active ?? '—'} />
        <StatCard label="Completed" value={queue?.completed?.toLocaleString() ?? '—'} />
        <StatCard label="Failed" value={queue?.failed?.toLocaleString() ?? '—'} />
      </div>
    </>
  );
}
