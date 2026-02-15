export function KPISkeleton() {
  return (
    <div
      className="rounded-2xl border p-6 animate-pulse"
      style={{
        background: 'linear-gradient(145deg, #1f2937, #111827)',
        borderColor: '#374151',
      }}
    >
      <div className="h-4 w-24 rounded" style={{ background: '#374151' }} />
      <div className="h-10 w-32 rounded mt-3" style={{ background: '#374151' }} />
      <div className="h-3 w-20 rounded mt-2" style={{ background: '#374151' }} />
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div
      className="rounded-2xl border overflow-hidden animate-pulse"
      style={{ borderColor: '#374151' }}
    >
      <div className="h-10" style={{ background: '#111827' }} />
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="h-12 border-t"
          style={{ background: i % 2 === 0 ? '#1f2937' : '#1a2332', borderColor: '#374151' }}
        />
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div
      className="rounded-2xl border p-6 animate-pulse"
      style={{
        background: 'linear-gradient(145deg, #1f2937, #111827)',
        borderColor: '#374151',
      }}
    >
      <div className="h-5 w-48 rounded mb-4" style={{ background: '#374151' }} />
      <div className="h-[300px] rounded" style={{ background: '#111827' }} />
    </div>
  )
}
