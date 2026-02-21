'use client'

import type { ReportingMonthlyRow } from '@/lib/queries'
import ViewToggle from './ViewToggle'
import GoalKPICard from './GoalKPICard'
import MonthlyTrendChart from './MonthlyTrendChart'
import ReportingTable from './ReportingTable'

function fmt(n: number): string {
  return n.toLocaleString()
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`
}

export default function ReportingClient({
  monthly,
}: {
  monthly: ReportingMonthlyRow[]
}) {
  // Show last 12 months of data
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-01`
  const filtered = monthly.filter(r => r.month >= cutoffStr)

  // Compute current KPIs from filtered data
  const totalReplies = filtered.reduce((s, r) => s + r.replies, 0)
  const totalPositive = filtered.reduce((s, r) => s + r.positive_replies, 0)

  // Simple average of each month's reply rate (spreadsheet uses AVERAGE of the rate column)
  const monthsWithData = filtered.filter(r => r.total_lead_contacted > 0)
  const avgReplyRate = monthsWithData.length > 0
    ? monthsWithData.reduce((s, r) => s + r.reply_rate, 0) / monthsWithData.length
    : 0

  // Weighted PRR: total positive replies / total replies (most statistically meaningful)
  const avgPRR = totalReplies > 0 ? (totalPositive / totalReplies) * 100 : 0

  // Leads per positive reply: weighted all-time
  const totalContacted = filtered.reduce((s, r) => s + r.total_lead_contacted, 0)
  const leadsPerPR = totalPositive > 0 ? Math.round(totalContacted / totalPositive) : 0

  // Auto:Human Reply Ratio (ARR) — deliverability health metric
  const totalAutoReplies = filtered.reduce((s, r) => s + (r.auto_replies || 0), 0)
  const arr = totalReplies > 0 ? totalAutoReplies / totalReplies : 0

  // Monthly table rows (most recent first)
  const monthlyTableRows = [...filtered].reverse().map(r => {
    const date = new Date(r.month + 'T00:00:00')
    const label = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    const monthArr = r.replies > 0 ? (r.auto_replies || 0) / r.replies : 0
    return [
      label,
      fmt(r.total_email_sent),
      fmt(r.total_lead_contacted),
      fmt(r.replies),
      pct(r.reply_rate),
      fmt(r.positive_replies),
      pct(r.prr),
      `${monthArr.toFixed(1)} : 1`,
    ]
  })

  const tableColumns = [
    'Emails Sent', 'Leads Contacted', 'Replies', 'Reply Rate',
    'Positive Replies', 'PRR', 'ARR',
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">KPIs</h1>
          <ViewToggle />
        </div>
      </div>

      {/* Goal KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GoalKPICard
          title="Avg Reply Rate"
          current={pct(avgReplyRate)}
          goal="1-2%"
          status={avgReplyRate >= 1 ? 'good' : 'bad'}
          subtitle={`Avg of ${monthsWithData.length} months`}
        />
        <GoalKPICard
          title="Positive Reply Rate"
          current={pct(avgPRR)}
          goal="15-20%"
          status={avgPRR >= 15 ? 'good' : avgPRR >= 10 ? 'warning' : 'bad'}
          subtitle={`${fmt(totalPositive)} of ${fmt(totalReplies)} human replies`}
        />
        <GoalKPICard
          title="Leads per Positive Reply"
          current={fmt(leadsPerPR)}
          goal="150-250"
          status={leadsPerPR <= 250 ? 'good' : leadsPerPR <= 400 ? 'warning' : 'bad'}
          subtitle={`${fmt(totalContacted)} contacted`}
        />
        <GoalKPICard
          title="Auto:Human Ratio"
          current={`${arr.toFixed(1)} : 1`}
          goal="< 2 : 1"
          status={arr < 2 ? 'good' : arr <= 3 ? 'warning' : 'bad'}
          subtitle={`${fmt(totalAutoReplies)} auto / ${fmt(totalReplies)} human`}
        />
      </div>

      {/* Monthly Trend Chart */}
      <MonthlyTrendChart data={filtered} />

      {/* Monthly Data Table */}
      <ReportingTable
        title="Monthly Data"
        dateLabel="Month"
        columns={tableColumns}
        rows={monthlyTableRows}
      />
    </div>
  )
}
