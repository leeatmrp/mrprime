interface ReportingTableProps {
  title: string
  columns: string[]
  rows: (string | number)[][]
  dateLabel: string
}

export default function ReportingTable({ title, columns, rows, dateLabel }: ReportingTableProps) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #1f2937, #111827)',
        borderColor: '#374151',
      }}
    >
      <div className="px-6 py-4 border-b" style={{ borderColor: '#374151' }}>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111827' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#94a3b8' }}>
                {dateLabel}
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-right px-4 py-3 font-medium whitespace-nowrap"
                  style={{ color: '#94a3b8' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="transition-colors hover:bg-white/[0.02]"
                style={{ borderTop: '1px solid #1f2937' }}
              >
                <td className="px-4 py-2.5 font-medium text-white whitespace-nowrap">
                  {row[0]}
                </td>
                {row.slice(1).map((cell, j) => (
                  <td
                    key={j}
                    className="text-right px-4 py-2.5 tabular-nums"
                    style={{ color: '#d1d5db' }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
