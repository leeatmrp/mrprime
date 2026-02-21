'use client'

import type { CopyAngleRow } from '@/lib/queries'
import ViewToggle from './ViewToggle'

function fmt(n: number): string {
  return n.toLocaleString()
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`
}

function arrColor(autoReplies: number, totalReplies: number): string {
  if (totalReplies === 0 || autoReplies === 0) return '#94a3b8' // grey — no data
  const ratio = autoReplies / totalReplies
  if (ratio >= 3) return '#ef4444'   // red — danger
  if (ratio >= 2) return '#f97316'   // orange — warning
  return '#22c55e'                    // green — healthy
}

function arrLabel(autoReplies: number, totalReplies: number): string {
  if (totalReplies === 0) return '—'
  if (autoReplies === 0) return '0:1'
  const humanReplies = totalReplies - autoReplies
  if (humanReplies <= 0) return `${autoReplies}:0`
  const ratio = autoReplies / humanReplies
  return `${ratio.toFixed(1)}:1`
}

interface MonthGroup {
  label: string
  rows: CopyAngleRow[]
  totals: {
    prospects: number
    replies: number
    replyRate: number
    positive: number
    prr: number
    booked: number
    bcRate: number
    autoReplies: number
  }
}

function groupByMonth(data: CopyAngleRow[]): MonthGroup[] {
  const groups: Record<string, CopyAngleRow[]> = {}

  for (const row of data) {
    if (row.total_prospects === 0 && row.total_replies === 0) continue
    if (!groups[row.month]) groups[row.month] = []
    groups[row.month].push(row)
  }

  // Sort months descending
  const sortedMonths = Object.keys(groups).sort((a, b) => b.localeCompare(a))

  return sortedMonths.map(month => {
    const rows = groups[month].sort((a, b) => a.campaign_name.localeCompare(b.campaign_name))
    const prospects = rows.reduce((s, r) => s + r.total_prospects, 0)
    const replies = rows.reduce((s, r) => s + r.total_replies, 0)
    const positive = rows.reduce((s, r) => s + r.positive_replies, 0)
    const booked = rows.reduce((s, r) => s + r.booked_calls, 0)
    const autoReplies = rows.reduce((s, r) => s + (r.auto_replies || 0), 0)

    const date = new Date(month + 'T00:00:00')
    const label = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })

    return {
      label,
      rows,
      totals: {
        prospects,
        replies,
        replyRate: prospects > 0 ? (replies / prospects) * 100 : 0,
        positive,
        prr: replies > 0 ? (positive / replies) * 100 : 0,
        booked,
        bcRate: positive > 0 ? (booked / positive) * 100 : 0,
        autoReplies,
      },
    }
  })
}

export default function CopyAnglesClient({ data }: { data: CopyAngleRow[] }) {
  const months = groupByMonth(data)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Copy Angles</h1>
          <ViewToggle />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: '#1e293b', background: '#0f172a' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: '#94a3b8' }}>Copy Angle</th>
              <th className="text-right px-4 py-3 font-semibold" style={{ color: '#94a3b8' }}>Prospects</th>
              <th className="text-right px-4 py-3 font-semibold" style={{ color: '#94a3b8' }}>Replies</th>
              <th className="text-right px-4 py-3 font-semibold" style={{ color: '#94a3b8' }}>Reply Rate</th>
              <th className="text-right px-4 py-3 font-semibold" style={{ color: '#94a3b8' }}>ARR</th>
              <th className="text-right px-4 py-3 font-semibold" style={{ color: '#94a3b8' }}>+Replies</th>
              <th className="text-right px-4 py-3 font-semibold" style={{ color: '#94a3b8' }}>PRR</th>
              <th className="text-right px-4 py-3 font-semibold" style={{ color: '#94a3b8' }}>Booked</th>
              <th className="text-right px-4 py-3 font-semibold" style={{ color: '#94a3b8' }}>BC Rate</th>
            </tr>
          </thead>
          <tbody>
            {months.map(group => (
              <MonthSection key={group.label} group={group} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MonthSection({ group }: { group: MonthGroup }) {
  return (
    <>
      {/* Month header */}
      <tr style={{ background: '#1e293b' }}>
        <td colSpan={9} className="px-4 py-2 font-bold text-white text-base">
          {group.label}
        </td>
      </tr>

      {/* Campaign rows */}
      {group.rows.map(row => (
        <tr
          key={`${row.month}-${row.campaign_name}`}
          className="hover:bg-white/5 transition-colors"
          style={{ borderBottom: '1px solid #1e293b' }}
        >
          <td className="px-4 py-2 text-white">{row.campaign_name}</td>
          <td className="px-4 py-2 text-right" style={{ color: '#94a3b8' }}>{fmt(row.total_prospects)}</td>
          <td className="px-4 py-2 text-right" style={{ color: '#94a3b8' }}>{fmt(row.total_replies)}</td>
          <td className="px-4 py-2 text-right" style={{ color: '#94a3b8' }}>{pct(row.reply_rate)}</td>
          <td className="px-4 py-2 text-right font-medium" style={{ color: arrColor(row.auto_replies || 0, row.total_replies) }}>
            {arrLabel(row.auto_replies || 0, row.total_replies)}
          </td>
          <td className="px-4 py-2 text-right" style={{ color: '#94a3b8' }}>{fmt(row.positive_replies)}</td>
          <td className="px-4 py-2 text-right" style={{ color: '#94a3b8' }}>{pct(row.prr)}</td>
          <td className="px-4 py-2 text-right" style={{ color: '#94a3b8' }}>{fmt(row.booked_calls)}</td>
          <td className="px-4 py-2 text-right" style={{ color: '#94a3b8' }}>{pct(row.booked_calls_rate)}</td>
        </tr>
      ))}

      {/* Totals row */}
      <tr style={{ borderBottom: '2px solid #374151', background: '#111827' }}>
        <td className="px-4 py-2 font-bold" style={{ color: '#f97316' }}>Total</td>
        <td className="px-4 py-2 text-right font-bold" style={{ color: '#f97316' }}>{fmt(group.totals.prospects)}</td>
        <td className="px-4 py-2 text-right font-bold" style={{ color: '#f97316' }}>{fmt(group.totals.replies)}</td>
        <td className="px-4 py-2 text-right font-bold" style={{ color: '#f97316' }}>{pct(group.totals.replyRate)}</td>
        <td className="px-4 py-2 text-right font-bold" style={{ color: arrColor(group.totals.autoReplies, group.totals.replies) }}>
          {arrLabel(group.totals.autoReplies, group.totals.replies)}
        </td>
        <td className="px-4 py-2 text-right font-bold" style={{ color: '#f97316' }}>{fmt(group.totals.positive)}</td>
        <td className="px-4 py-2 text-right font-bold" style={{ color: '#f97316' }}>{pct(group.totals.prr)}</td>
        <td className="px-4 py-2 text-right font-bold" style={{ color: '#f97316' }}>{fmt(group.totals.booked)}</td>
        <td className="px-4 py-2 text-right font-bold" style={{ color: '#f97316' }}>{pct(group.totals.bcRate)}</td>
      </tr>
    </>
  )
}
