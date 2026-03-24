export default function StatCard({ label, value, detail }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">
        {value ?? '—'}
      </div>
      {detail && <div className="mt-1 text-xs text-gray-400">{detail}</div>}
    </div>
  );
}
