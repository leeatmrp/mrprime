import { CampaignRow } from '@/lib/queries'

const statusLabels: Record<number, { label: string; bg: string; text: string }> = {
  0: { label: 'Draft', bg: '#374151', text: '#94a3b8' },
  1: { label: 'Active', bg: '#064e3b', text: '#10b981' },
  2: { label: 'Paused', bg: '#7c2d12', text: '#f97316' },
  3: { label: 'Completed', bg: '#1e3a5f', text: '#3b82f6' },
}

function bounceColor(rate: number): string {
  if (rate < 1.5) return '#10b981'
  if (rate < 2.5) return '#f59e0b'
  return '#ef4444'
}

export default function CampaignTable({ campaigns }: { campaigns: CampaignRow[] }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: '#374151' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111827' }}>
              {['Campaign', 'Status', 'Sent', 'Replies', 'Reply %', 'Bounces', 'Bounce %', 'Opps'].map(h => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-medium whitespace-nowrap"
                  style={{ color: '#94a3b8' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const sent = c.emails_sent_count || 0
              const replyRate = sent > 0 ? (c.reply_count / sent) * 100 : 0
              const bRate = sent > 0 ? (c.bounce_count / sent) * 100 : 0
              const status = statusLabels[c.status] || statusLabels[0]

              return (
                <tr
                  key={c.id}
                  className="border-t transition-colors hover:bg-white/[0.02]"
                  style={{ borderColor: '#374151' }}
                >
                  <td className="px-4 py-3 font-medium text-white max-w-[250px] truncate">
                    {c.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: status.bg, color: status.text }}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white tabular-nums">
                    {sent.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: '#06b6d4' }}>
                    {(c.reply_count || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: '#06b6d4' }}>
                    {replyRate.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 tabular-nums text-white">
                    {(c.bounce_count || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: bounceColor(bRate) }}>
                    {bRate.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: '#ec4899' }}>
                    {c.total_opportunities || 0}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
