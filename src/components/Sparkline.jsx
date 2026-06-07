export default function Sparkline({ values, color = '#6366f1', width = 120, height = 28 }) {
  const series = (values || []).filter(v => typeof v === 'number' && !Number.isNaN(v));
  if (series.length < 2) {
    return <span className="text-xs text-gray-300">—</span>;
  }
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  const step = width / (series.length - 1);
  const points = series
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
