import { SupabaseClient } from '@supabase/supabase-js'

export interface KPIData {
  totalSent: number
  totalReplies: number
  replyRate: number
  totalBounces: number
  bounceRate: number
  totalOpportunities: number
  activeCampaigns: number
  totalCampaigns: number
}

export interface CampaignRow {
  id: string
  name: string
  status: number
  emails_sent_count: number
  reply_count: number
  bounce_count: number
  total_opportunities: number
  leads_count: number
  contacted_count: number
  open_count: number
}

export interface DailyDataPoint {
  date: string
  sent: number
  replies: number
  opportunities: number
}

export interface WarmupHealth {
  healthy: number
  good: number
  warning: number
  avgScore: number
}

export async function fetchKPIs(supabase: SupabaseClient): Promise<KPIData> {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('emails_sent_count, reply_count, bounce_count, total_opportunities, status')
    .eq('status', 1)

  if (error) console.error('fetchKPIs error:', error)
  if (!campaigns) {
    return {
      totalSent: 0, totalReplies: 0, replyRate: 0,
      totalBounces: 0, bounceRate: 0, totalOpportunities: 0,
      activeCampaigns: 0, totalCampaigns: 0,
    }
  }

  const totalSent = campaigns.reduce((sum, c) => sum + (c.emails_sent_count || 0), 0)
  const totalReplies = campaigns.reduce((sum, c) => sum + (c.reply_count || 0), 0)
  const totalBounces = campaigns.reduce((sum, c) => sum + (c.bounce_count || 0), 0)
  const totalOpportunities = campaigns.reduce((sum, c) => sum + (c.total_opportunities || 0), 0)

  return {
    totalSent,
    totalReplies,
    replyRate: totalSent > 0 ? (totalReplies / totalSent) * 100 : 0,
    totalBounces,
    bounceRate: totalSent > 0 ? (totalBounces / totalSent) * 100 : 0,
    totalOpportunities,
    activeCampaigns: campaigns.length,
    totalCampaigns: campaigns.length,
  }
}

export async function fetchCampaigns(supabase: SupabaseClient): Promise<CampaignRow[]> {
  const { data } = await supabase
    .from('campaigns')
    .select('id, name, status, emails_sent_count, reply_count, bounce_count, total_opportunities, leads_count, contacted_count, open_count')
    .eq('status', 1)
    .order('emails_sent_count', { ascending: false })

  return data || []
}

export async function fetchDailyAnalytics(supabase: SupabaseClient): Promise<DailyDataPoint[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0]

  const { data } = await supabase
    .from('daily_analytics')
    .select('date, sent, unique_replies, opportunities')
    .gte('date', dateStr)
    .order('date', { ascending: true })

  if (!data) return []

  // Group by date and sum
  const grouped: Record<string, DailyDataPoint> = {}
  for (const row of data) {
    if (!grouped[row.date]) {
      grouped[row.date] = { date: row.date, sent: 0, replies: 0, opportunities: 0 }
    }
    grouped[row.date].sent += row.sent || 0
    grouped[row.date].replies += row.unique_replies || 0
    grouped[row.date].opportunities += row.opportunities || 0
  }

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date))
}

export async function fetchWarmupHealth(supabase: SupabaseClient): Promise<WarmupHealth> {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('stat_warmup_score')
    .eq('status', 1)

  if (!accounts || accounts.length === 0) {
    return { healthy: 0, good: 0, warning: 0, avgScore: 0 }
  }

  let healthy = 0, good = 0, warning = 0, totalScore = 0
  for (const a of accounts) {
    const score = a.stat_warmup_score || 0
    totalScore += score
    if (score >= 95) healthy++
    else if (score >= 80) good++
    else warning++
  }

  return {
    healthy,
    good,
    warning,
    avgScore: Math.round((totalScore / accounts.length) * 10) / 10,
  }
}
