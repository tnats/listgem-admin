import { useState } from 'react';
import { useFeaturedList } from '../../api/hooks';
import client from '../../api/client';

export default function FeaturedList() {
  const { data: featured, isLoading, refetch } = useFeaturedList();
  const [listIdInput, setListIdInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function setOverride(e) {
    e.preventDefault();
    if (!listIdInput.trim()) return;
    setActionLoading(true);
    setMessage('');
    try {
      const { data } = await client.post('/admin/featured', { listId: listIdInput.trim() });
      setMessage(data.message);
      setListIdInput('');
      refetch();
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  async function clearOverride() {
    setActionLoading(true);
    setMessage('');
    try {
      const { data } = await client.delete('/admin/featured');
      setMessage(data.message);
      refetch();
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <>
      {/* Current Featured */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Current Featured List</h2>
        {isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : !featured ? (
          <div className="text-sm text-gray-400">No featured list set.</div>
        ) : (
          <div className="flex items-start gap-4">
            {featured.cover_image && (
              <img
                src={featured.cover_image}
                alt=""
                className="w-20 h-28 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <div className="font-medium text-gray-900">{featured.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {featured.thing_type} {featured.category && `/ ${featured.category}`}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {featured.item_count} items &middot; {featured.like_count} likes
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Curator: {featured.curator?.display_name || featured.curator?.username}
              </div>
              <div className="text-xs text-indigo-500 mt-1">
                Reason: {featured.featured_reason}
              </div>
              <div className="text-[10px] text-gray-300 mt-1 font-mono">
                {featured.list_id}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Override Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Override Featured List</h2>

        <form onSubmit={setOverride} className="flex gap-2 mb-3">
          <input
            type="text"
            value={listIdInput}
            onChange={e => setListIdInput(e.target.value)}
            placeholder="Enter list ID (e.g. list_abc123...)"
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={actionLoading || !listIdInput.trim()}
            className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            Set Override
          </button>
        </form>

        <button
          onClick={clearOverride}
          disabled={actionLoading}
          className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Clear Override (return to algorithmic)
        </button>

        {message && (
          <div className={`mt-3 p-2 rounded text-sm ${
            message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}>
            {message}
          </div>
        )}
      </div>
    </>
  );
}
