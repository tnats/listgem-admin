import StatCard from '../../components/StatCard';
import { useSystemStatus } from '../../api/hooks';

function formatUptime(seconds) {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SystemStatus() {
  const { data, isLoading } = useSystemStatus();

  if (isLoading) return <div className="text-sm text-gray-500">Loading...</div>;

  const env = data?.env || {};
  const redisInfo = data?.redis || {};
  const dbInfo = data?.database || {};

  const configured = Object.values(env).filter(v => v.configured).length;
  const missing = Object.values(env).filter(v => !v.configured).length;

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Node Version" value={data?.node_version} />
        <StatCard label="Environment" value={data?.node_env} />
        <StatCard label="Uptime" value={formatUptime(data?.uptime_seconds)} />
        <StatCard label="LLM Provider" value={data?.llm_provider} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Environment Variables */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-1">Environment Variables</h2>
          <p className="text-xs text-gray-400 mb-3">{configured} configured, {missing} missing</p>
          <div className="space-y-1">
            {Object.entries(env).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="font-mono text-gray-600">{key}</span>
                {val.configured ? (
                  <span className="text-green-600">
                    {val.value || val.preview || 'Set'}
                  </span>
                ) : (
                  <span className="text-red-500 font-medium">Missing</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Redis + Database */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Redis</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={redisInfo.connected ? 'text-green-600' : 'text-red-500'}>
                  {redisInfo.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {redisInfo.connected && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Memory</span>
                    <span className="text-gray-700">{redisInfo.memory}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Keys</span>
                    <span className="text-gray-700 tabular-nums">{redisInfo.keys?.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Database Pool</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Connections</span>
                <span className="text-gray-700 tabular-nums">{dbInfo.totalCount ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Idle</span>
                <span className="text-gray-700 tabular-nums">{dbInfo.idleCount ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Waiting</span>
                <span className="text-gray-700 tabular-nums">{dbInfo.waitingCount ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
