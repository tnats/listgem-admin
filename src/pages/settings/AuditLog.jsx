import { useState } from 'react';
import StatusBadge from '../../components/StatusBadge';
import { useAuditLog } from '../../api/hooks';

const ACTION_TYPES = [
  '', 'content_removed', 'content_hidden', 'content_approved',
  'user_warned', 'user_suspended', 'user_banned', 'user_unbanned',
  'report_resolved', 'report_dismissed', 'flag_validated', 'flag_dismissed',
];

export default function AuditLog() {
  const [actionType, setActionType] = useState('');
  const [page, setPage] = useState(0);
  const limit = 30;
  const { data, isLoading } = useAuditLog({ limit, offset: page * limit, actionType });

  const actions = data?.actions || [];
  const seedRuns = data?.seed_runs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  function exportCsv() {
    const headers = 'timestamp,action_type,target_type,target_id,moderator_id,reason,notes\n';
    const rows = actions.map(a =>
      [a.created_at, a.action_type, a.target_type, a.target_id, a.moderator_id, `"${(a.reason || '').replace(/"/g, '""')}"`, `"${(a.notes || '').replace(/"/g, '""')}"`].join(',')
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={actionType}
          onChange={e => { setActionType(e.target.value); setPage(0); }}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All action types</option>
          {ACTION_TYPES.filter(Boolean).map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button
          onClick={exportCsv}
          disabled={actions.length === 0}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30"
        >
          Export CSV
        </button>
        <span className="text-xs text-gray-400 ml-auto">{total} actions total</span>
      </div>

      {/* Moderation Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Moderation Actions</h2>
        {isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : actions.length === 0 ? (
          <div className="text-xs text-gray-400">No moderation actions recorded.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left pb-2">Time</th>
                <th className="text-left pb-2">Action</th>
                <th className="text-left pb-2">Target</th>
                <th className="text-left pb-2">Moderator</th>
                <th className="text-left pb-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {actions.map(a => (
                <tr key={a.action_id} className="border-t border-gray-50">
                  <td className="py-1.5 text-gray-400 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td className="py-1.5">
                    <StatusBadge status={a.action_type?.split('_')[0]} />
                    <span className="ml-1 text-gray-600">{a.action_type?.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="py-1.5 text-gray-500">
                    {a.target_type} <span className="text-gray-400">#{a.target_id?.substring(0, 12)}</span>
                  </td>
                  <td className="py-1.5 text-gray-500 truncate max-w-[120px]">{a.moderator_id?.substring(0, 20)}</td>
                  <td className="py-1.5 text-gray-500 truncate max-w-[200px]">{a.reason || a.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs border rounded disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-xs text-gray-400">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-xs border rounded disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Seed Runs */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Recent Seed Runs</h2>
        {seedRuns.length === 0 ? (
          <div className="text-xs text-gray-400">No seed runs recorded.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left pb-2">Time</th>
                <th className="text-left pb-2">Source</th>
                <th className="text-left pb-2">Status</th>
                <th className="text-right pb-2">Created</th>
                <th className="text-right pb-2">Skipped</th>
                <th className="text-right pb-2">Failed</th>
                <th className="text-left pb-2">By</th>
              </tr>
            </thead>
            <tbody>
              {seedRuns.map(r => (
                <tr key={r.id} className="border-t border-gray-50">
                  <td className="py-1.5 text-gray-400 whitespace-nowrap">
                    {new Date(r.started_at).toLocaleString()}
                  </td>
                  <td className="py-1.5 text-gray-600">{r.source}</td>
                  <td className="py-1.5"><StatusBadge status={r.status} /></td>
                  <td className="py-1.5 text-right text-gray-500 tabular-nums">{r.created_count}</td>
                  <td className="py-1.5 text-right text-gray-500 tabular-nums">{r.skipped_count}</td>
                  <td className="py-1.5 text-right text-gray-500 tabular-nums">{r.failed_count}</td>
                  <td className="py-1.5 text-gray-400 truncate max-w-[120px]">{r.started_by?.substring(0, 20) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
