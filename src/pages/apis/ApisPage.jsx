import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { useApiStatus } from '../../api/hooks';
import client from '../../api/client';

const STATUS_COLORS = {
  healthy: 'border-green-300 bg-green-50',
  error: 'border-red-300 bg-red-50',
  not_configured: 'border-gray-200 bg-gray-50',
  unknown: 'border-gray-200 bg-white',
};

const DOT_COLORS = {
  healthy: 'bg-green-500',
  error: 'bg-red-500',
  not_configured: 'bg-gray-300',
  unknown: 'bg-gray-300',
};

export default function ApisPage() {
  const { data, isLoading, refetch } = useApiStatus();
  const [pingResults, setPingResults] = useState({});
  const [pinging, setPinging] = useState({});
  const [pingAllLoading, setPingAllLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const apis = data?.apis || [];

  async function pingOne(name) {
    setPinging(p => ({ ...p, [name]: true }));
    try {
      const { data: result } = await client.post(`/admin/apis/${name}/ping`);
      setPingResults(p => ({ ...p, [name]: result }));
      refetch();
    } catch (err) {
      setPingResults(p => ({ ...p, [name]: { status: 'error', message: err.message, response_time_ms: 0 } }));
    } finally {
      setPinging(p => ({ ...p, [name]: false }));
    }
  }

  async function pingAll() {
    setPingAllLoading(true);
    try {
      const { data: result } = await client.post('/admin/apis/ping-all');
      const map = {};
      for (const r of result.results) {
        map[r.name] = r;
      }
      setPingResults(map);
      refetch();
    } catch (err) {
      console.error('Ping all failed:', err.message);
    } finally {
      setPingAllLoading(false);
    }
  }

  if (isLoading) return <div className="text-sm text-gray-500">Loading...</div>;

  const configured = apis.filter(a => a.configured).length;
  const total = apis.length;

  return (
    <>
      <PageHeader title="API Management" description="Third-party API status, health checks, and usage tracking" />

      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-gray-500">
          {configured}/{total} APIs configured
        </div>
        <button
          onClick={pingAll}
          disabled={pingAllLoading}
          className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {pingAllLoading ? 'Testing...' : 'Test All APIs'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {apis.map(api => {
          const ping = pingResults[api.name];
          // Use manual ping result, fall back to auto-health check
          const pingStatus = ping?.status || api.health_status || (api.configured ? 'unknown' : 'not_configured');
          const borderColor = STATUS_COLORS[pingStatus] || STATUS_COLORS.unknown;
          const dotColor = DOT_COLORS[pingStatus] || DOT_COLORS.unknown;
          const rl = api.rate_limit_live;
          const isExpanded = expanded === api.name;

          return (
            <div
              key={api.name}
              className={`rounded-lg border p-4 transition-colors ${borderColor}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                  <span className="text-sm font-semibold text-gray-900">{api.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {ping && (
                    <span className="text-xs text-gray-400">{ping.response_time_ms}ms</span>
                  )}
                  <button
                    onClick={() => pingOne(api.name)}
                    disabled={pinging[api.name] || !api.configured}
                    className="px-2 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30"
                  >
                    {pinging[api.name] ? '...' : 'Ping'}
                  </button>
                </div>
              </div>

              {/* Purpose + Rate Limit */}
              <div className="text-xs text-gray-500 mb-2">{api.purpose}</div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
                <span>Rate: {api.rate_limit}</span>
                {rl && rl.remaining && (
                  <span className={`font-medium ${parseInt(rl.remaining) < parseInt(rl.limit) * 0.1 ? 'text-red-500' : 'text-green-600'}`}>
                    {rl.remaining}/{rl.limit} remaining
                  </span>
                )}
                {api.docs && (
                  <a href={api.docs} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">
                    Docs
                  </a>
                )}
                {api.dashboard && (
                  <a href={api.dashboard} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">
                    Dashboard
                  </a>
                )}
              </div>

              {/* Status */}
              {!api.configured ? (
                <div className="text-xs text-orange-500 font-medium">Not configured — API key missing</div>
              ) : (
                <>
                  {/* Usage */}
                  <div className="flex gap-4 text-xs mt-2">
                    <div>
                      <span className="text-gray-400">24h calls: </span>
                      <span className="text-gray-700 tabular-nums font-medium">{api.calls_24h}</span>
                    </div>
                    {api.errors_24h > 0 && (
                      <div>
                        <span className="text-gray-400">Errors: </span>
                        <span className="text-red-500 tabular-nums font-medium">{api.errors_24h}</span>
                      </div>
                    )}
                    {api.avg_response_ms && (
                      <div>
                        <span className="text-gray-400">Avg: </span>
                        <span className="text-gray-700 tabular-nums">{api.avg_response_ms}ms</span>
                      </div>
                    )}
                  </div>

                  {/* Ping Result */}
                  {ping && (
                    <div className={`mt-2 text-xs ${ping.status === 'healthy' ? 'text-green-600' : 'text-red-500'}`}>
                      {ping.message}
                    </div>
                  )}

                  {/* Last call */}
                  {api.last_call && (
                    <div className="text-[10px] text-gray-300 mt-1">
                      Last call: {new Date(api.last_call).toLocaleString()}
                    </div>
                  )}

                  {/* Auto-health status */}
                  {api.health_checked_at && !ping && (
                    <div className="text-[10px] text-gray-300 mt-1">
                      Auto-check: {api.health_status} ({api.health_response_ms}ms) — {new Date(api.health_checked_at).toLocaleTimeString()}
                    </div>
                  )}

                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : api.name)}
                    className="text-[10px] text-indigo-500 mt-2 hover:underline"
                  >
                    {isExpanded ? 'Hide details' : 'Show details'}
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && <ApiDetail name={api.name} />}
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function ApiDetail({ name }) {
  const { data, isLoading } = useApiUsageDetail(name);

  if (isLoading) return <div className="text-xs text-gray-400 mt-2">Loading usage...</div>;

  const summary = data?.summary || {};
  const recent = data?.recent_calls || [];

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div>
          <span className="text-gray-400">Total</span>
          <div className="text-gray-700 font-medium tabular-nums">{summary.total || 0}</div>
        </div>
        <div>
          <span className="text-gray-400">Success</span>
          <div className="text-green-600 font-medium tabular-nums">{summary.success || 0}</div>
        </div>
        <div>
          <span className="text-gray-400">Errors</span>
          <div className="text-red-500 font-medium tabular-nums">{summary.errors || 0}</div>
        </div>
      </div>

      {recent.length > 0 && (
        <>
          <div className="text-[10px] text-gray-400 mb-1">Recent calls</div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {recent.slice(0, 10).map((call, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className={call.status_code >= 400 ? 'text-red-500' : 'text-green-600'}>
                  {call.status_code || '—'}
                </span>
                <span className="text-gray-500 truncate flex-1">{call.endpoint}</span>
                <span className="text-gray-400 tabular-nums">{call.response_time_ms}ms</span>
                <span className="text-gray-300">{new Date(call.called_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Inline hook for detail panel (avoids circular dependency)
import { useQuery } from '@tanstack/react-query';
function useApiUsageDetail(name) {
  return useQuery({
    queryKey: ['admin', 'apis', name, 'usage'],
    queryFn: () => client.get(`/admin/apis/${name}/usage`).then(r => r.data),
    staleTime: 30_000,
    enabled: !!name,
  });
}
