import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useSeedStatus, useSeedHistory } from '../../api/hooks';
import SeedRunner from './SeedRunner';

export default function SeedingPage() {
  const { data: status, isLoading: statusLoading } = useSeedStatus();
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useSeedHistory();

  return (
    <>
      <PageHeader title="Registry Seeding" description="Registry status, seed triggers, and run history" />

      {/* Status Cards */}
      {statusLoading ? (
        <div className="text-sm text-gray-500 mb-6">Loading status...</div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Total Things" value={status?.total_things?.toLocaleString()} />
          <StatCard label="Canonical IDs" value={status?.total_canonical_ids?.toLocaleString()} />
          <StatCard label="URL Cache" value={status?.total_url_cache?.toLocaleString()} />
        </div>
      )}

      {/* Things by Type + IDs by Source side by side */}
      {status && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-80 overflow-y-auto">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Things by Type</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs uppercase">
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {status.by_type.map(row => (
                  <tr key={row.type} className="border-t border-gray-50">
                    <td className="py-1 text-gray-600">{row.type}</td>
                    <td className="py-1 text-right text-gray-500 tabular-nums">{row.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Canonical IDs by Source</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs uppercase">
                  <th className="pb-2">Source</th>
                  <th className="pb-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {status.by_source.map(row => (
                  <tr key={row.source} className="border-t border-gray-50">
                    <td className="py-1 text-gray-600">{row.source}</td>
                    <td className="py-1 text-right text-gray-500 tabular-nums">{row.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 className="text-sm font-medium text-gray-700 mt-4 mb-3">IDs by Type</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs uppercase">
                  <th className="pb-2">ID Type</th>
                  <th className="pb-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {status.by_id_type.map(row => (
                  <tr key={row.id_type} className="border-t border-gray-50">
                    <td className="py-1 text-gray-600">{row.id_type}</td>
                    <td className="py-1 text-right text-gray-500 tabular-nums">{row.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seed Runner */}
      <SeedRunner onComplete={refetchHistory} />

      {/* Seed History */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Seed Run History</h2>
        {historyLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : !historyData?.runs?.length ? (
          <div className="text-sm text-gray-400">No seed runs yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase">
                <th className="pb-2">Source</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Created</th>
                <th className="pb-2 text-right">Skipped</th>
                <th className="pb-2 text-right">Failed</th>
                <th className="pb-2 text-right">Duration</th>
                <th className="pb-2">Started</th>
              </tr>
            </thead>
            <tbody>
              {historyData.runs.map(run => (
                <tr key={run.id} className="border-t border-gray-100">
                  <td className="py-1.5 text-gray-600">{run.source}</td>
                  <td className="py-1.5"><StatusBadge status={run.status} /></td>
                  <td className="py-1.5 text-right text-gray-500 tabular-nums">{run.created_count}</td>
                  <td className="py-1.5 text-right text-gray-500 tabular-nums">{run.skipped_count}</td>
                  <td className="py-1.5 text-right text-gray-500 tabular-nums">{run.failed_count}</td>
                  <td className="py-1.5 text-right text-gray-500 tabular-nums">
                    {run.duration_seconds ? `${Math.round(run.duration_seconds)}s` : '—'}
                  </td>
                  <td className="py-1.5 text-gray-400 text-xs">
                    {new Date(run.started_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
