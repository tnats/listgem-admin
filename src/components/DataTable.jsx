/**
 * Shared table. Fifteen pages hand-rolled `<table>` before this; new surfaces
 * should use it so header/row/empty states stay identical across the portal.
 *
 * columns: [{ key, header, align, width, className, render(row, i) }]
 */
export default function DataTable({
  columns,
  rows,
  rowKey = (row, i) => row.id ?? i,
  empty = 'Nothing to show.',
  loading = false,
  onRowClick,
  isRowActive,
  rowClassName,
  dense = false,
}) {
  const pad = dense ? 'py-1' : 'py-2';

  if (loading) {
    return <div className="px-1 py-3 text-sm text-gray-500">Loading…</div>;
  }
  if (!rows || rows.length === 0) {
    return <div className="px-1 py-6 text-center text-sm text-gray-500">{empty}</div>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase text-gray-400">
          {columns.map(col => (
            <th
              key={col.key}
              scope="col"
              className={`pb-2 font-medium ${col.align === 'right' ? 'text-right' : ''} ${col.width || ''}`}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const active = isRowActive?.(row, i);
          return (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row, i) : undefined}
              className={`border-t border-gray-100 ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} ${
                active ? 'bg-indigo-50/60' : ''
              } ${rowClassName?.(row, i) || ''}`}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`${pad} align-top ${col.align === 'right' ? 'text-right' : ''} ${col.className || ''}`}
                >
                  {col.render ? col.render(row, i) : row[col.key]}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
