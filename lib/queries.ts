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

function currentMonthStart(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export async function fetchKPIs(supabase: SupabaseClient): Promise<KPIData> {
  const dateStr = currentMonthStart()

  // Get active campaign IDs and bounce data
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, bounce_count, emails_sent_count')
    .eq('status', 1)

  const activeCampaignIds = campaigns?.map(c => c.id) || []

  // Use per-campaign daily data for active campaigns only
  const { data, error } = await supabase
    .from('daily_analytics')
    .select('new_leads_contacted, unique_replies, opportunities, campaign_id')
    .gte('date', dateStr)
    .not('campaign_id', 'is', null)
    .in('campaign_id', activeCampaignIds)

  if (error) console.error('fetchKPIs error:', error)

  if (!data || data.length === 0) {
    return {
      totalSent: 0, totalReplies: 0, replyRate: 0,
      totalBounces: 0, bounceRate: 0, totalOpportunities: 0,
      activeCampaigns: campaigns?.length || 0, totalCampaigns: campaigns?.length || 0,
    }
  }

  const totalSent = data.reduce((sum, r) => sum + (r.new_leads_contacted || 0), 0)
  const totalReplies = data.reduce((sum, r) => sum + (r.unique_replies || 0), 0)
  const totalOpportunities = data.reduce((sum, r) => sum + (r.opportunities || 0), 0)

  // Bounces aren't tracked in daily_analytics — use all-time from campaigns table
  const totalBounces = campaigns?.reduce((sum, c) => sum + (c.bounce_count || 0), 0) || 0
  const allTimeSent = campaigns?.reduce((sum, c) => sum + (c.emails_sent_count || 0), 0) || 0

  return {
    totalSent,
    totalReplies,
    replyRate: totalSent > 0 ? (totalReplies / totalSent) * 100 : 0,
    totalBounces,
    bounceRate: allTimeSent > 0 ? (totalBounces / allTimeSent) * 100 : 0,
    totalOpportunities,
    activeCampaigns: campaigns?.length || 0,
    totalCampaigns: campaigns?.length || 0,
  }
}

export async function fetchCampaigns(supabase: SupabaseClient): Promise<CampaignRow[]> {
  const dateStr = currentMonthStart()

  // Get current calendar month daily_analytics per campaign
  const { data: dailyData } = await supabase
    .from('daily_analytics')
    .select('campaign_id, new_leads_contacted, unique_replies, opportunities')
    .gte('date', dateStr)
    .not('campaign_id', 'is', null)

  // Get campaign metadata
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, emails_sent_count, reply_count, bounce_count, total_opportunities, leads_count, contacted_count, open_count')
    .eq('status', 1)

  if (!campaigns) return []

  const hasPerCampaignData = dailyData?.some(r => r.campaign_id != null) || false

  if (hasPerCampaignData && dailyData) {
    const monthlyByCampaign: Record<string, { sent: number; replies: number; opps: number }> = {}
    for (const row of dailyData) {
      if (!row.campaign_id) continue
      if (!monthlyByCampaign[row.campaign_id]) {
        monthlyByCampaign[row.campaign_id] = { sent: 0, replies: 0, opps: 0 }
      }
      monthlyByCampaign[row.campaign_id].sent += row.new_leads_contacted || 0
      monthlyByCampaign[row.campaign_id].replies += row.unique_replies || 0
      monthlyByCampaign[row.campaign_id].opps += row.opportunities || 0
    }

    return campaigns
      .map(c => {
        const monthly = monthlyByCampaign[c.id] || { sent: 0, replies: 0, opps: 0 }
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          emails_sent_count: monthly.sent,
          reply_count: monthly.replies,
          bounce_count: 0,
          total_opportunities: monthly.opps,
          leads_count: c.leads_count || 0,
          contacted_count: c.contacted_count || 0,
          open_count: 0,
        }
      })
      .filter(c => c.emails_sent_count > 0)
      .sort((a, b) => b.emails_sent_count - a.emails_sent_count)
  }

  // Fallback: no per-campaign daily data, show all-time
  return campaigns
    .map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      emails_sent_count: c.emails_sent_count || 0,
      reply_count: c.reply_count || 0,
      bounce_count: c.bounce_count || 0,
      total_opportunities: c.total_opportunities || 0,
      leads_count: c.leads_count || 0,
      contacted_count: c.contacted_count || 0,
      open_count: c.open_count || 0,
    }))
    .filter(c => c.emails_sent_count > 0)
    .sort((a, b) => b.emails_sent_count - a.emails_sent_count)
}

export async function fetchWeeklyKPIs(supabase: SupabaseClient): Promise<KPIData> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const dateStr = sevenDaysAgo.toISOString().split('T')[0]

  // Get active campaign IDs
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('status', 1)

  const activeCampaignIds = campaigns?.map(c => c.id) || []

  // Use per-campaign daily data for active campaigns only
  const { data } = await supabase
    .from('daily_analytics')
    .select('new_leads_contacted, unique_replies, opportunities')
    .gte('date', dateStr)
    .not('campaign_id', 'is', null)
    .in('campaign_id', activeCampaignIds)

  if (!data || data.length === 0) {
    return {
      totalSent: 0, totalReplies: 0, replyRate: 0,
      totalBounces: 0, bounceRate: 0, totalOpportunities: 0,
      activeCampaigns: campaigns?.length || 0, totalCampaigns: campaigns?.length || 0,
    }
  }

  const totalSent = data.reduce((sum, r) => sum + (r.new_leads_contacted || 0), 0)
  const totalReplies = data.reduce((sum, r) => sum + (r.unique_replies || 0), 0)
  const totalOpportunities = data.reduce((sum, r) => sum + (r.opportunities || 0), 0)

  return {
    totalSent,
    totalReplies,
    replyRate: totalSent > 0 ? (totalReplies / totalSent) * 100 : 0,
    totalBounces: 0,
    bounceRate: 0,
    totalOpportunities,
    activeCampaigns: campaigns?.length || 0,
    totalCampaigns: campaigns?.length || 0,
  }
}

export async function fetchWeeklyCampaigns(supabase: SupabaseClient): Promise<CampaignRow[]> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const dateStr = sevenDaysAgo.toISOString().split('T')[0]

  // Get last 7 days of daily_analytics per campaign (only rows with campaign_id)
  const { data: dailyData } = await supabase
    .from('daily_analytics')
    .select('campaign_id, new_leads_contacted, unique_replies, opportunities')
    .gte('date', dateStr)
    .not('campaign_id', 'is', null)

  // Get campaign metadata (name, status, leads)
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, emails_sent_count, reply_count, bounce_count, total_opportunities, leads_count, contacted_count, open_count')
    .eq('status', 1)

  if (!campaigns) return []

  // Check if per-campaign daily data exists
  const hasPerCampaignData = dailyData?.some(r => r.campaign_id != null) || false

  if (hasPerCampaignData && dailyData) {
    // Aggregate daily data by campaign
    const weeklyByCampaign: Record<string, { sent: number; replies: number; opps: number }> = {}
    for (const row of dailyData) {
      if (!row.campaign_id) continue
      if (!weeklyByCampaign[row.campaign_id]) {
        weeklyByCampaign[row.campaign_id] = { sent: 0, replies: 0, opps: 0 }
      }
      weeklyByCampaign[row.campaign_id].sent += row.new_leads_contacted || 0
      weeklyByCampaign[row.campaign_id].replies += row.unique_replies || 0
      weeklyByCampaign[row.campaign_id].opps += row.opportunities || 0
    }

    return campaigns
      .map(c => {
        const weekly = weeklyByCampaign[c.id] || { sent: 0, replies: 0, opps: 0 }
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          emails_sent_count: weekly.sent,
          reply_count: weekly.replies,
          bounce_count: 0,
          total_opportunities: weekly.opps,
          leads_count: c.leads_count || 0,
          contacted_count: c.contacted_count || 0,
          open_count: 0,
        }
      })
      .filter(c => c.emails_sent_count > 0)
      .sort((a, b) => b.emails_sent_count - a.emails_sent_count)
  }

  // Fallback: no per-campaign daily data, show active campaigns with their totals
  return campaigns
    .map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      emails_sent_count: c.emails_sent_count || 0,
      reply_count: c.reply_count || 0,
      bounce_count: c.bounce_count || 0,
      total_opportunities: c.total_opportunities || 0,
      leads_count: c.leads_count || 0,
      contacted_count: c.contacted_count || 0,
      open_count: c.open_count || 0,
    }))
    .filter(c => c.emails_sent_count > 0)
    .sort((a, b) => b.emails_sent_count - a.emails_sent_count)
}

export async function fetchDailyAnalytics(supabase: SupabaseClient, days: number = 0): Promise<DailyDataPoint[]> {
  let dateStr: string
  if (days > 0) {
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - days)
    dateStr = daysAgo.toISOString().split('T')[0]
  } else {
    dateStr = currentMonthStart()
  }

  // Get active campaign IDs
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('status', 1)

  const activeCampaignIds = campaigns?.map(c => c.id) || []

  // Use per-campaign data for active campaigns, summed by date
  const { data } = await supabase
    .from('daily_analytics')
    .select('date, new_leads_contacted, unique_replies, opportunities')
    .gte('date', dateStr)
    .not('campaign_id', 'is', null)
    .in('campaign_id', activeCampaignIds)
    .order('date', { ascending: true })

  if (!data) return []

  // Group by date and sum
  const grouped: Record<string, DailyDataPoint> = {}
  for (const row of data) {
    if (!grouped[row.date]) {
      grouped[row.date] = { date: row.date, sent: 0, replies: 0, opportunities: 0 }
    }
    grouped[row.date].sent += row.new_leads_contacted || 0
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
