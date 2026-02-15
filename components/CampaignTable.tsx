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

function progressColor(pct: number): string {
  if (pct >= 100) return '#3b82f6'
  if (pct >= 80) return '#f59e0b'
  return '#10b981'
}

export default function CampaignTable({ campaigns }: { campaigns: CampaignRow[] }) {
  const totals = campaigns.reduce(
    (acc, c) => {
      acc.leads += c.leads_count || 0
      acc.seqStarted += c.contacted_count || 0
      acc.replies += c.reply_count || 0
      acc.bounces += c.bounce_count || 0
      acc.opps += c.total_opportunities || 0
      return acc
    },
    { leads: 0, seqStarted: 0, replies: 0, bounces: 0, opps: 0 }
  )
  const totalReplyPct = totals.seqStarted > 0 ? (totals.replies / totals.seqStarted) * 100 : 0
  const totalBouncePct = totals.seqStarted > 0 ? (totals.bounces / totals.seqStarted) * 100 : 0
  const totalCompletedPct = totals.leads > 0 ? Math.min((totals.seqStarted / totals.leads) * 100, 100) : 0
  const totalLeadsLeft = Math.max(totals.leads - totals.seqStarted, 0)

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: '#374151' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111827' }}>
              {['Campaign', 'Status', 'Total Leads', 'Seq Started', 'Replies', 'Reply %', 'Bounced', 'Bounce %', 'Opps', 'Completed %', 'Leads Left'].map(h => (
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
              const leads = c.leads_count || 0
              const seqStarted = c.contacted_count || 0
              const bounces = c.bounce_count || 0
              const replyPct = seqStarted > 0 ? (c.reply_count / seqStarted) * 100 : 0
              const bouncePct = seqStarted > 0 ? (bounces / seqStarted) * 100 : 0
              const completedPct = leads > 0 ? Math.min((seqStarted / leads) * 100, 100) : 0
              const leadsLeft = Math.max(leads - seqStarted, 0)
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
                  <td className="px-4 py-3 tabular-nums" style={{ color: '#94a3b8' }}>
                    {leads.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-white">
                    {seqStarted.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: '#06b6d4' }}>
                    {(c.reply_count || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: '#06b6d4' }}>
                    {replyPct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 tabular-nums text-white">
                    {bounces.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: bounceColor(bouncePct) }}>
                    {bouncePct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: '#ec4899' }}>
                    {c.total_opportunities || 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#374151', minWidth: '40px' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${completedPct}%`,
                            background: progressColor(completedPct),
                          }}
                        />
                      </div>
                      <span className="tabular-nums text-xs whitespace-nowrap" style={{ color: progressColor(completedPct) }}>
                        {completedPct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: leadsLeft > 0 ? '#f59e0b' : '#6b7280' }}>
                    {leadsLeft.toLocaleString()}
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
              <td className="px-4 py-3 tabular-nums" style={{ color: '#94a3b8' }}>
                {totals.leads.toLocaleString()}
              </td>
              <td className="px-4 py-3 tabular-nums text-white">
                {totals.seqStarted.toLocaleString()}
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: '#06b6d4' }}>
                {totals.replies.toLocaleString()}
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: '#06b6d4' }}>
                {totalReplyPct.toFixed(2)}%
              </td>
              <td className="px-4 py-3 tabular-nums text-white">
                {totals.bounces.toLocaleString()}
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: bounceColor(totalBouncePct) }}>
                {totalBouncePct.toFixed(2)}%
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: '#ec4899' }}>
                {totals.opps}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#374151', minWidth: '40px' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${totalCompletedPct}%`,
                        background: progressColor(totalCompletedPct),
                      }}
                    />
                  </div>
                  <span className="tabular-nums text-xs whitespace-nowrap" style={{ color: progressColor(totalCompletedPct) }}>
                    {totalCompletedPct.toFixed(0)}%
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: totalLeadsLeft > 0 ? '#f59e0b' : '#6b7280' }}>
                {totalLeadsLeft.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
