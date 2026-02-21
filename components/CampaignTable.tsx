import { CampaignRow } from '@/lib/queries'

const statusLabels: Record<number, { label: string; bg: string; text: string }> = {
  0: { label: 'Draft', bg: '#374151', text: '#94a3b8' },
  1: { label: 'Active', bg: '#064e3b', text: '#10b981' },
  2: { label: 'Paused', bg: '#7c2d12', text: '#f97316' },
  3: { label: 'Completed', bg: '#1e3a5f', text: '#3b82f6' },
}

export default function CampaignTable({ campaigns }: { campaigns: CampaignRow[] }) {
  const totals = campaigns.reduce(
    (acc, c) => {
      acc.contacted += c.emails_sent_count || 0
      acc.replies += c.reply_count || 0
      acc.autoReplies += c.auto_reply_count || 0
      acc.opps += c.total_opportunities || 0
      return acc
    },
    { contacted: 0, replies: 0, autoReplies: 0, opps: 0 }
  )
  const totalReplyPct = totals.contacted > 0 ? (totals.replies / totals.contacted) * 100 : 0
  const totalArr = totals.replies > 0 ? totals.autoReplies / totals.replies : 0

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: '#374151' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111827' }}>
              {['Campaign', 'Status', 'Contacted', 'Replies', 'Reply %', 'ARR', 'Opps'].map(h => (
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
              const contacted = c.emails_sent_count || 0
              const replyPct = contacted > 0 ? (c.reply_count / contacted) * 100 : 0
              // unique_replies = human replies, unique_replies_automatic = auto (independent counts)
              const campArr = c.reply_count > 0 ? (c.auto_reply_count || 0) / c.reply_count : 0
              const status = statusLabels[c.status] || statusLabels[0]
              const arrColor = campArr < 2 ? '#10b981' : campArr <= 3 ? '#f97316' : '#ef4444'

              return (
                <tr
                  key={c.id}
                  className="border-t transition-colors hover:bg-white/[0.02]"
                  style={{ borderColor: '#374151' }}
                >
                  <td className="px-4 py-3 font-medium text-white max-w-[300px] truncate">
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
                  <td className="px-4 py-3 tabular-nums text-white">
                    {contacted.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: '#06b6d4' }}>
                    {(c.reply_count || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: '#06b6d4' }}>
                    {replyPct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: arrColor }}>
                    {c.reply_count > 0 ? `${campArr.toFixed(1)}:1` : '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: '#ec4899' }}>
                    {c.total_opportunities || 0}
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
                {totals.contacted.toLocaleString()}
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: '#06b6d4' }}>
                {totals.replies.toLocaleString()}
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: '#06b6d4' }}>
                {totalReplyPct.toFixed(2)}%
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: totalArr < 2 ? '#10b981' : totalArr <= 3 ? '#f97316' : '#ef4444' }}>
                {totals.replies > 0 ? `${totalArr.toFixed(1)}:1` : '—'}
              </td>
              <td className="px-4 py-3 tabular-nums" style={{ color: '#ec4899' }}>
                {totals.opps}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
