import { useState } from 'react';
import StatusBadge from '../../components/StatusBadge';
import { useAdminUsers } from '../../api/hooks';
import client from '../../api/client';

export default function UserManagement() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const limit = 15;
  const { data, isLoading, refetch } = useAdminUsers({ search, limit, offset: page * limit });

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Action modal state
  const [modal, setModal] = useState(null); // { type, user }
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(7);
  const [actionLoading, setActionLoading] = useState(false);

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  }

  async function performAction() {
    setActionLoading(true);
    const adminId = JSON.parse(sessionStorage.getItem('user'))?.user_id;
    try {
      if (modal.type === 'ban') {
        await client.post('/moderation/bans', {
          userId: modal.user.user_id,
          bannedBy: adminId,
          banType: 'temporary',
          reason,
          durationDays: duration,
        });
      } else if (modal.type === 'suspend') {
        await client.post('/moderation/suspensions', {
          userId: modal.user.user_id,
          suspendedBy: adminId,
          reason,
          durationHours: duration * 24,
        });
      } else if (modal.type === 'warn') {
        await client.post('/moderation/warnings', {
          userId: modal.user.user_id,
          issuedBy: adminId,
          reason,
          severity: 'medium',
        });
      }
      setModal(null);
      setReason('');
      refetch();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <>
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by username, email, or display name..."
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
        >
          Search
        </button>
      </form>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-xs text-gray-400 mb-3">{total} users total</div>

        {isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase">
                <th className="pb-2">User</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Location</th>
                <th className="pb-2 text-right">Followers</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Joined</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.user_id} className="border-t border-gray-100">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200" />
                      )}
                      <span className="text-gray-700 font-medium">{user.username}</span>
                    </div>
                  </td>
                  <td className="py-2 text-gray-500 text-xs">{user.email}</td>
                  <td className="py-2 text-gray-400 text-xs">
                    {[user.city, user.state, user.country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="py-2 text-right text-gray-500 tabular-nums">{user.follower_count}</td>
                  <td className="py-2">
                    {user.is_admin && <StatusBadge status="admin" />}
                    {user.is_moderator && <StatusBadge status="moderator" />}
                    {!user.is_admin && !user.is_moderator && <span className="text-xs text-gray-400">user</span>}
                  </td>
                  <td className="py-2 text-gray-400 text-xs">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => { setModal({ type: 'warn', user }); setReason(''); }}
                        className="px-2 py-0.5 text-xs bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100"
                      >
                        Warn
                      </button>
                      <button
                        onClick={() => { setModal({ type: 'suspend', user }); setReason(''); setDuration(1); }}
                        className="px-2 py-0.5 text-xs bg-orange-50 text-orange-600 rounded hover:bg-orange-100"
                      >
                        Suspend
                      </button>
                      <button
                        onClick={() => { setModal({ type: 'ban', user }); setReason(''); setDuration(7); }}
                        className="px-2 py-0.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                      >
                        Ban
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
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

      {/* Action Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 capitalize">
              {modal.type} User
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {modal.user.username} ({modal.user.email})
            </p>

            <label className="block text-xs text-gray-500 mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Reason for this action..."
            />

            {(modal.type === 'ban' || modal.type === 'suspend') && (
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">
                  Duration ({modal.type === 'ban' ? 'days' : 'days'})
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={e => setDuration(parseInt(e.target.value) || 1)}
                  min={1}
                  className="w-24 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-1.5 text-sm text-gray-600 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={performAction}
                disabled={!reason || actionLoading}
                className="px-4 py-1.5 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : `Confirm ${modal.type}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
