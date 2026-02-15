interface KPICardProps {
  title: string
  value: string | number
  color: 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink'
  subtext?: string
  change?: number
  changeDirection?: 'good-up' | 'good-down'
}

const colorMap: Record<string, string> = {
  green: '#10b981',
  blue: '#3b82f6',
  yellow: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  orange: '#f97316',
  cyan: '#06b6d4',
  pink: '#ec4899',
}

export default function KPICard({ title, value, color, subtext, change, changeDirection }: KPICardProps) {
  const accentColor = colorMap[color]

  let changeColor = '#94a3b8'
  let arrow = ''
  if (change !== undefined) {
    const isPositive = change > 0
    if (changeDirection === 'good-up') {
      changeColor = isPositive ? '#10b981' : '#ef4444'
    } else if (changeDirection === 'good-down') {
      changeColor = isPositive ? '#ef4444' : '#10b981'
    }
    arrow = isPositive ? '\u25B2' : '\u25BC'
  }

  return (
    <div
      className="rounded-2xl border p-6 transition-transform duration-300 hover:-translate-y-1 cursor-default"
      style={{
        background: 'linear-gradient(145deg, #1f2937, #111827)',
        borderColor: '#374151',
      }}
    >
      <p className="text-sm font-medium mb-2" style={{ color: '#94a3b8' }}>
        {title}
      </p>
      <p className="text-4xl font-bold mb-1" style={{ color: accentColor }}>
        {value}
      </p>
      <div className="flex items-center gap-2">
        {subtext && (
          <span className="text-xs" style={{ color: '#6b7280' }}>
            {subtext}
          </span>
        )}
        {change !== undefined && (
          <span className="text-xs font-medium" style={{ color: changeColor }}>
            {arrow} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}
