import { SupabaseClient } from '@supabase/supabase-js'

export interface KPIData {
  totalContacted: number
  totalReplies: number
  replyRate: number
  totalBounces: number
  bounceRate: number
  totalOpportunities: number
  meetingsBooked: number
  activeCampaigns: number
  totalCampaigns: number
}

export interface CampaignRow {
  id: string
  name: string
  status: number
  total_emails_sent: number
  contacted_count: number
  reply_count: number
  human_reply_count: number
  positive_replies: number
  bounce_count: number
  total_opportunities: number
  auto_reply_count: number
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

export interface ReportingMonthlyRow {
  month: string
  total_email_sent: number
  total_lead_contacted: number
  replies: number
  reply_rate: number
  positive_replies: number
  prr: number
  booked_calls: number
  booked_calls_rate: number
  not_interested: number
  out_of_office: number
  auto_replies: number
}

export interface ReportingWeeklyRow {
  week_start: string
  total_email_sent: number
  total_lead_contacted: number
  replies: number
  reply_rate: number
  positive_replies: number
  prr: number
  booked_calls: number
  booked_calls_rate: number
}

// Exclude all CAP campaigns from dashboard views (not core email outreach)
function isExcludedCampaign(name: string): boolean {
  return /\bCAP\b/i.test(name)
}

// Extract copy angle name (mirrors sync/route.ts extractCopyAngle).
// Used to identify angle names belonging to CAP campaigns.
function extractCopyAngle(campaignName: string): string {
  const parts = campaignName.split(' - ')
  if (parts.length >= 4) return parts.slice(3).join(' - ').trim()
  if (parts.length === 3) return parts[2].trim()
  return campaignName.trim()
}

async function getExcludedCampaignIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from('campaigns').select('id, name')
  if (!data) return []
  return data.filter(c => isExcludedCampaign(c.name)).map(c => c.id)
}

// Copy angle names belonging to CAP campaigns. These angle names may not
// themselves contain "CAP" (e.g. "Product: MyProtein" is from a TikTok CAP
// campaign), so isExcludedCampaign(name) alone misses them.
async function getExcludedCopyAngleNames(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.from('campaigns').select('id, name')
  if (!data) return new Set()
  return new Set(
    data
      .filter(c => isExcludedCampaign(c.name))
      .map(c => extractCopyAngle(c.name))
  )
}

function currentMonthStart(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export async function fetchKPIs(supabase: SupabaseClient): Promise<KPIData> {
  const dateStr = currentMonthStart()
  const excludedIds = await getExcludedCampaignIds(supabase)

  // Get all per-campaign daily data in the month (includes paused/completed)
  let query = supabase
    .from('daily_analytics')
    .select('new_leads_contacted, unique_replies, opportunities')
    .gte('date', dateStr)
    .not('campaign_id', 'is', null)
  if (excludedIds.length > 0) {
    query = query.not('campaign_id', 'in', `(${excludedIds.join(',')})`)
  }
  const { data, error } = await query

  if (error) console.error('fetchKPIs error:', error)

  // Count currently active campaigns for the KPI card (excluding CAP)
  let countQuery = supabase
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('status', 1)
  if (excludedIds.length > 0) {
    countQuery = countQuery.not('id', 'in', `(${excludedIds.join(',')})`)
  }
  const { count: activeCampaigns } = await countQuery

  if (!data || data.length === 0) {
    return {
      totalContacted: 0, totalReplies: 0, replyRate: 0,
      totalBounces: 0, bounceRate: 0, totalOpportunities: 0,
      meetingsBooked: 0,
      activeCampaigns: activeCampaigns || 0, totalCampaigns: activeCampaigns || 0,
    }
  }

  const totalContacted = data.reduce((sum, r) => sum + (r.new_leads_contacted || 0), 0)
  const totalReplies = data.reduce((sum, r) => sum + (r.unique_replies || 0), 0)
  const totalOpportunities = data.reduce((sum, r) => sum + (r.opportunities || 0), 0)

  return {
    totalContacted,
    totalReplies,
    replyRate: totalContacted > 0 ? (totalReplies / totalContacted) * 100 : 0,
    totalBounces: 0,
    bounceRate: 0,
    totalOpportunities,
    meetingsBooked: 0,
    activeCampaigns: activeCampaigns || 0,
    totalCampaigns: activeCampaigns || 0,
  }
}

export async function fetchCampaigns(supabase: SupabaseClient): Promise<CampaignRow[]> {
  const dateStr = currentMonthStart()

  // Get MTD daily_analytics per campaign (all campaigns, not just active)
  const { data: dailyData } = await supabase
    .from('daily_analytics')
    .select('campaign_id, sent, new_leads_contacted, unique_replies, unique_replies_automatic, opportunities')
    .gte('date', dateStr)
    .not('campaign_id', 'is', null)

  if (!dailyData) return []

  // Aggregate daily data by campaign
  const byCampaign: Record<string, { sent: number; contacted: number; replies: number; autoReplies: number; opps: number }> = {}
  for (const row of dailyData) {
    if (!row.campaign_id) continue
    if (!byCampaign[row.campaign_id]) {
      byCampaign[row.campaign_id] = { sent: 0, contacted: 0, replies: 0, autoReplies: 0, opps: 0 }
    }
    byCampaign[row.campaign_id].sent += row.sent || 0
    byCampaign[row.campaign_id].contacted += row.new_leads_contacted || 0
    byCampaign[row.campaign_id].replies += row.unique_replies || 0
    byCampaign[row.campaign_id].autoReplies += row.unique_replies_automatic || 0
    byCampaign[row.campaign_id].opps += row.opportunities || 0
  }

  // Get metadata for all campaigns that had activity in the window
  const campaignIds = Object.keys(byCampaign)
  if (campaignIds.length === 0) return []

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, positive_replies')
    .in('id', campaignIds)

  if (!campaigns) return []

  return campaigns
    .filter(c => !isExcludedCampaign(c.name))
    .map(c => {
      const mtd = byCampaign[c.id] || { sent: 0, contacted: 0, replies: 0, autoReplies: 0, opps: 0 }
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        total_emails_sent: mtd.sent,
        contacted_count: mtd.contacted,
        reply_count: mtd.replies + mtd.autoReplies,
        human_reply_count: mtd.replies,
        positive_replies: c.positive_replies || 0,
        bounce_count: 0,
        total_opportunities: mtd.opps,
        auto_reply_count: mtd.autoReplies,
      }
    })
    .filter(c => c.contacted_count > 0 || c.reply_count > 0 || c.total_opportunities > 0)
    .sort((a, b) => b.contacted_count - a.contacted_count)
}

export async function fetchWeeklyKPIs(supabase: SupabaseClient): Promise<KPIData> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const dateStr = sevenDaysAgo.toISOString().split('T')[0]
  const excludedIds = await getExcludedCampaignIds(supabase)

  // Get all per-campaign daily data in the 7-day window (includes paused/completed campaigns)
  let query = supabase
    .from('daily_analytics')
    .select('new_leads_contacted, unique_replies, opportunities')
    .gte('date', dateStr)
    .not('campaign_id', 'is', null)
  if (excludedIds.length > 0) {
    query = query.not('campaign_id', 'in', `(${excludedIds.join(',')})`)
  }
  const { data } = await query

  // Count currently active campaigns separately for the KPI card (excluding CAP)
  let countQuery = supabase
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('status', 1)
  if (excludedIds.length > 0) {
    countQuery = countQuery.not('id', 'in', `(${excludedIds.join(',')})`)
  }
  const { count: activeCampaigns } = await countQuery

  if (!data || data.length === 0) {
    return {
      totalContacted: 0, totalReplies: 0, replyRate: 0,
      totalBounces: 0, bounceRate: 0, totalOpportunities: 0,
      meetingsBooked: 0,
      activeCampaigns: activeCampaigns || 0, totalCampaigns: activeCampaigns || 0,
    }
  }

  const totalContacted = data.reduce((sum, r) => sum + (r.new_leads_contacted || 0), 0)
  const totalReplies = data.reduce((sum, r) => sum + (r.unique_replies || 0), 0)
  const totalOpportunities = data.reduce((sum, r) => sum + (r.opportunities || 0), 0)

  return {
    totalContacted,
    totalReplies,
    replyRate: totalContacted > 0 ? (totalReplies / totalContacted) * 100 : 0,
    totalBounces: 0,
    bounceRate: 0,
    totalOpportunities,
    meetingsBooked: 0,
    activeCampaigns: activeCampaigns || 0,
    totalCampaigns: activeCampaigns || 0,
  }
}

export async function fetchWeeklyCampaigns(supabase: SupabaseClient): Promise<CampaignRow[]> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const dateStr = sevenDaysAgo.toISOString().split('T')[0]

  // Get 7-day daily_analytics per campaign (all campaigns, not just active)
  const { data: dailyData } = await supabase
    .from('daily_analytics')
    .select('campaign_id, sent, new_leads_contacted, unique_replies, unique_replies_automatic, opportunities')
    .gte('date', dateStr)
    .not('campaign_id', 'is', null)

  if (!dailyData) return []

  // Aggregate daily data by campaign
  const byCampaign: Record<string, { sent: number; contacted: number; replies: number; autoReplies: number; opps: number }> = {}
  for (const row of dailyData) {
    if (!row.campaign_id) continue
    if (!byCampaign[row.campaign_id]) {
      byCampaign[row.campaign_id] = { sent: 0, contacted: 0, replies: 0, autoReplies: 0, opps: 0 }
    }
    byCampaign[row.campaign_id].sent += row.sent || 0
    byCampaign[row.campaign_id].contacted += row.new_leads_contacted || 0
    byCampaign[row.campaign_id].replies += row.unique_replies || 0
    byCampaign[row.campaign_id].autoReplies += row.unique_replies_automatic || 0
    byCampaign[row.campaign_id].opps += row.opportunities || 0
  }

  // Get metadata for all campaigns that had activity in the window
  const campaignIds = Object.keys(byCampaign)
  if (campaignIds.length === 0) return []

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, positive_replies')
    .in('id', campaignIds)

  if (!campaigns) return []

  return campaigns
    .filter(c => !isExcludedCampaign(c.name))
    .map(c => {
      const weekly = byCampaign[c.id] || { sent: 0, contacted: 0, replies: 0, autoReplies: 0, opps: 0 }
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        total_emails_sent: weekly.sent,
        contacted_count: weekly.contacted,
        reply_count: weekly.replies + weekly.autoReplies,
        human_reply_count: weekly.replies,
        positive_replies: c.positive_replies || 0,
        bounce_count: 0,
        total_opportunities: weekly.opps,
        auto_reply_count: weekly.autoReplies,
      }
    })
    .filter(c => c.contacted_count > 0 || c.reply_count > 0 || c.total_opportunities > 0)
    .sort((a, b) => b.contacted_count - a.contacted_count)
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

  const excludedIds = await getExcludedCampaignIds(supabase)

  // Include ALL campaigns that had activity in the window (excluding CAP)
  let query = supabase
    .from('daily_analytics')
    .select('date, new_leads_contacted, unique_replies, opportunities')
    .gte('date', dateStr)
    .not('campaign_id', 'is', null)
    .order('date', { ascending: true })
  if (excludedIds.length > 0) {
    query = query.not('campaign_id', 'in', `(${excludedIds.join(',')})`)
  }
  const { data } = await query

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

export async function fetchReportingMonthly(supabase: SupabaseClient): Promise<ReportingMonthlyRow[]> {
  const { data, error } = await supabase
    .from('reporting_monthly')
    .select('month, total_email_sent, total_lead_contacted, replies, reply_rate, positive_replies, prr, booked_calls, booked_calls_rate, not_interested, out_of_office, auto_replies')
    .order('month', { ascending: true })

  if (error) console.error('fetchReportingMonthly error:', error)
  return (data || []) as ReportingMonthlyRow[]
}

export interface CopyAngleRow {
  month: string
  campaign_name: string
  total_prospects: number
  total_replies: number
  reply_rate: number
  positive_replies: number
  prr: number
  booked_calls: number
  booked_calls_rate: number
  auto_replies: number
}

export async function fetchCopyAnglesMonthly(supabase: SupabaseClient): Promise<CopyAngleRow[]> {
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('copy_angles_monthly')
    .select('month, campaign_name, total_prospects, total_replies, reply_rate, positive_replies, prr, booked_calls, booked_calls_rate, auto_replies')
    .gte('month', cutoffStr)
    .order('month', { ascending: false })

  if (error) console.error('fetchCopyAnglesMonthly error:', error)
  const excludedAngleNames = await getExcludedCopyAngleNames(supabase)
  return ((data || []) as CopyAngleRow[]).filter(
    r => !isExcludedCampaign(r.campaign_name) && !excludedAngleNames.has(r.campaign_name)
  )
}

export async function fetchReportingWeekly(supabase: SupabaseClient): Promise<ReportingWeeklyRow[]> {
  const { data, error } = await supabase
    .from('reporting_weekly')
    .select('week_start, total_email_sent, total_lead_contacted, replies, reply_rate, positive_replies, prr, booked_calls, booked_calls_rate')
    .gt('total_lead_contacted', 0)
    .order('week_start', { ascending: true })

  if (error) console.error('fetchReportingWeekly error:', error)
  return (data || []) as ReportingWeeklyRow[]
}
