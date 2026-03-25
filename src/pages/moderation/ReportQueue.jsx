import { useState } from 'react';
import StatusBadge from '../../components/StatusBadge';
import StatCard from '../../components/StatCard';
import { useModerationQueue, useModerationStats } from '../../api/hooks';
import client from '../../api/client';

const STATUSES = ['pending', 'reviewing', 'resolved', 'dismissed'];

export default function ReportQueue() {
  const [status, setStatus] = useState('pending');
  const { data: stats } = useModerationStats();
  const { data: queue, isLoading, refetch } = useModerationQueue(status);

  const reports = queue?.reports || [];

  async function updateReport(reportId, newStatus, notes = '') {
    try {
      await client.put(`/moderation/reports/${reportId}`, {
        moderatorId: JSON.parse(sessionStorage.getItem('user'))?.user_id,
        status: newStatus,
        moderationNotes: notes,
      });
      refetch();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    }
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Pending" value={stats?.pending_reports ?? '—'} />
        <StatCard label="Reviewing" value={stats?.reviewing_reports ?? '—'} />
        <StatCard label="Active Bans" value={stats?.active_bans ?? '—'} />
        <StatCard label="Flagged Users" value={stats?.flagged_users ?? '—'} />
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 mb-4">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1 text-xs rounded-full font-medium ${
              status === s
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : reports.length === 0 ? (
          <div className="text-sm text-gray-400">No {status} reports.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase">
                <th className="pb-2">Content</th>
                <th className="pb-2">Reason</th>
                <th className="pb-2">Severity</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Reported</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(report => (
                <tr key={report.report_id} className="border-t border-gray-100">
                  <td className="py-2">
                    <span className="text-gray-600">{report.content_type}</span>
                    <span className="text-gray-400 text-xs ml-1">#{report.content_id?.substring(0, 12)}</span>
                  </td>
                  <td className="py-2 text-gray-600">{report.reason}</td>
                  <td className="py-2">
                    <StatusBadge status={report.severity} />
                  </td>
                  <td className="py-2">
                    <StatusBadge status={report.status} />
                  </td>
                  <td className="py-2 text-gray-400 text-xs">
                    {new Date(report.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2 text-right">
                    {report.status === 'pending' && (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => updateReport(report.report_id, 'reviewing')}
                          className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => updateReport(report.report_id, 'dismissed')}
                          className="px-2 py-0.5 text-xs bg-gray-50 text-gray-500 rounded hover:bg-gray-100"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                    {report.status === 'reviewing' && (
                      <button
                        onClick={() => updateReport(report.report_id, 'resolved', 'Resolved via admin portal')}
                        className="px-2 py-0.5 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100"
                      >
                        Resolve
                      </button>
                    )}
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
