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
  // Totals for footer
  const totals = campaigns.reduce(
    (acc, c) => {
      acc.leads += c.leads_count || 0
      acc.contacted += c.contacted_count || 0
      acc.sent += c.emails_sent_count || 0
      acc.replies += c.reply_count || 0
      acc.bounces += c.bounce_count || 0
      acc.opps += c.total_opportunities || 0
      return acc
    },
    { leads: 0, contacted: 0, sent: 0, replies: 0, bounces: 0, opps: 0 }
  )
  const totalLeadsLeft = totals.leads - totals.contacted
  const totalProgressPct = totals.leads > 0 ? Math.min((totals.contacted / totals.leads) * 100, 100) : 0
  const totalReplyRate = totals.sent > 0 ? (totals.replies / totals.sent) * 100 : 0
  const totalBounceRate = totals.sent > 0 ? (totals.bounces / totals.sent) * 100 : 0

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: '#374151' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111827' }}>
              {['Campaign', 'Status', 'Contacted', 'Replies', 'Reply %', 'Bounces', 'Bounce %', 'Opps', 'Leads Left', 'Progress'].map(h => (
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
              const leads = c.leads_count || 0
              const contacted = c.contacted_count || 0
              const leadsLeft = leads - contacted
              const progressPct = leads > 0 ? Math.min((contacted / leads) * 100, 100) : 0
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
                  <td className="px-4 py-3 tabular-nums" style={{ color: leadsLeft > 0 ? '#f59e0b' : '#6b7280' }}>
                    {leadsLeft.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: progressPct > 80 ? '#ef4444' : progressPct > 50 ? '#f59e0b' : '#10b981' }}>
                    {progressPct.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr
              className="border-t-2 font-semibold"
              style={{ background: '#111827', borderColor: '#4b5563' }}
            >
              <td className="px-4 py-3 text-white">Total ({campaigns.length})</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 tabular-nums text-white">
                {totals.sent.toLocaleString()}
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: '#06b6d4' }}>
                {totals.replies.toLocaleString()}
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: '#06b6d4' }}>
                {totalReplyRate.toFixed(2)}%
              </td>
              <td className="px-4 py-3 tabular-nums text-white">
                {totals.bounces.toLocaleString()}
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: bounceColor(totalBounceRate) }}>
                {totalBounceRate.toFixed(2)}%
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: '#ec4899' }}>
                {totals.opps}
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: '#f59e0b' }}>
                {totalLeadsLeft.toLocaleString()}
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: totalProgressPct > 80 ? '#ef4444' : totalProgressPct > 50 ? '#f59e0b' : '#10b981' }}>
                {totalProgressPct.toFixed(1)}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
