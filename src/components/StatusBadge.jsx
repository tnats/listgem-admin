const COLORS = {
  healthy: 'bg-green-100 text-green-700',
  stale: 'bg-yellow-100 text-yellow-700',
  down: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export default function StatusBadge({ status }) {
  const color = COLORS[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}
