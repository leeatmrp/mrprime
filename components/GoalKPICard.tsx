interface GoalKPICardProps {
  title: string
  current: string
  goal: string
  status: 'good' | 'warning' | 'bad' | 'info'
  subtitle?: string
}

const statusColors: Record<string, { accent: string; bg: string }> = {
  good: { accent: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  warning: { accent: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  bad: { accent: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  info: { accent: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
}

export default function GoalKPICard({ title, current, goal, status, subtitle }: GoalKPICardProps) {
  const { accent, bg } = statusColors[status]

  return (
    <div
      className="rounded-2xl border p-5 transition-transform duration-300 hover:-translate-y-1 cursor-default"
      style={{
        background: 'linear-gradient(145deg, #1f2937, #111827)',
        borderColor: '#374151',
      }}
    >
      <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: '#6b7280' }}>
        {title}
      </p>
      <p className="text-3xl font-bold mb-1" style={{ color: accent }}>
        {current}
      </p>
      <div className="flex items-center gap-2 mt-2">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ background: bg, color: accent }}
        >
          Goal: {goal}
        </span>
      </div>
      {subtitle && (
        <p className="text-xs mt-2" style={{ color: '#6b7280' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
