import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const INSTANTLY_API = 'https://api.instantly.ai/api/v2'
const INSTANTLY_KEY = process.env.INSTANTLY_API_KEY!
const CRON_SECRET = process.env.CRON_SECRET!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

function instantlyHeaders() {
  return {
    'Authorization': `Bearer ${INSTANTLY_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function fetchInstantly(path: string) {
  const res = await fetch(`${INSTANTLY_API}${path}`, { headers: instantlyHeaders() })
  if (!res.ok) throw new Error(`Instantly ${path}: ${res.status} ${res.statusText}`)
  return res.json()
}

async function syncCampaigns(supabase: Supabase) {
  const analytics = await fetchInstantly('/campaigns/analytics')
  if (!analytics || !Array.isArray(analytics)) return { synced: 0 }

  const rows = analytics.map((c: Record<string, number | string>) => ({
    id: c.campaign_id as string,
    name: c.campaign_name as string,
    status: c.campaign_status as number,
    emails_sent_count: (c.emails_sent_count as number) || 0,
    reply_count: (c.reply_count as number) || 0,
    bounce_count: (c.bounced_count as number) || 0,
    total_opportunities: (c.total_opportunities as number) || 0,
    leads_count: (c.leads_count as number) || 0,
    contacted_count: (c.contacted_count as number) || 0,
    open_count: (c.open_count as number) || 0,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('campaigns')
    .upsert(rows, { onConflict: 'id' })

  if (error) throw new Error(`Campaigns upsert: ${error.message}`)
  return { synced: rows.length }
}

async function syncAccounts(supabase: Supabase) {
  let allAccounts: Record<string, unknown>[] = []
  let cursor: string | null = null

  do {
    const params = new URLSearchParams({ limit: '100' })
    if (cursor) params.set('starting_after', cursor)
    const data = await fetchInstantly(`/accounts?${params}`)
    const items = data.items || data
    if (Array.isArray(items)) allAccounts = allAccounts.concat(items)
    cursor = data.pagination?.next_starting_after || null
  } while (cursor)

  if (allAccounts.length === 0) return { synced: 0 }

  const rows = allAccounts.map((a) => ({
    email: a.email as string,
    first_name: (a.first_name as string) || '',
    last_name: (a.last_name as string) || '',
    status: (a.status as number) || 0,
    warmup_status: (a.warmup_status as number) || 0,
    provider_code: (a.provider_code as number) || 0,
    stat_warmup_score: (a.stat_warmup_score as number) || 0,
    updated_at: new Date().toISOString(),
  }))

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const { error } = await supabase
      .from('accounts')
      .upsert(batch, { onConflict: 'email' })
    if (error) throw new Error(`Accounts upsert batch ${i}: ${error.message}`)
  }

  return { synced: rows.length }
}

async function syncDailyAnalytics(supabase: Supabase) {
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 31)
  const startDate = windowStart.toISOString().split('T')[0]
  const endDate = new Date().toISOString().split('T')[0]

  // 1. Aggregate daily analytics
  const aggData = await fetchInstantly(
    `/campaigns/analytics/daily?start_date=${startDate}&end_date=${endDate}`
  )

  let aggDays = 0
  if (Array.isArray(aggData)) {
    for (const day of aggData) {
      await supabase
        .from('daily_analytics')
        .delete()
        .eq('date', day.date)
        .is('campaign_id', null)

      await supabase
        .from('daily_analytics')
        .insert({
          date: day.date,
          campaign_id: null,
          sent: day.sent || 0,
          contacted: day.contacted || 0,
          new_leads_contacted: day.new_leads_contacted || 0,
          opened: day.opened || 0,
          unique_opened: day.unique_opened || 0,
          replies: day.replies || 0,
          unique_replies: day.unique_replies || 0,
          replies_automatic: day.replies_automatic || 0,
          unique_replies_automatic: day.unique_replies_automatic || 0,
          clicks: day.clicks || 0,
          unique_clicks: day.unique_clicks || 0,
          opportunities: day.opportunities || 0,
          unique_opportunities: day.unique_opportunities || 0,
        })
      aggDays++
    }
  }

  // 2. Per-campaign daily analytics for active campaigns
  const { data: activeCampaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('status', 1)

  if (activeCampaigns) {
    for (const campaign of activeCampaigns) {
      const campData = await fetchInstantly(
        `/campaigns/analytics/daily?campaign_id=${campaign.id}&start_date=${startDate}&end_date=${endDate}`
      )

      if (Array.isArray(campData)) {
        for (const day of campData) {
          await supabase
            .from('daily_analytics')
            .delete()
            .eq('date', day.date)
            .eq('campaign_id', campaign.id)

          await supabase
            .from('daily_analytics')
            .insert({
              date: day.date,
              campaign_id: campaign.id,
              sent: day.sent || 0,
              contacted: day.contacted || 0,
              new_leads_contacted: day.new_leads_contacted || 0,
              opened: day.opened || 0,
              unique_opened: day.unique_opened || 0,
              replies: day.replies || 0,
              unique_replies: day.unique_replies || 0,
              replies_automatic: day.replies_automatic || 0,
              unique_replies_automatic: day.unique_replies_automatic || 0,
              clicks: day.clicks || 0,
              unique_clicks: day.unique_clicks || 0,
              opportunities: day.opportunities || 0,
              unique_opportunities: day.unique_opportunities || 0,
            })
        }
      }
    }
  }

  // 3. Reconcile opportunities against campaign analytics (source of truth)
  let oppsFixed = 0
  if (activeCampaigns) {
    const monthStart = new Date()
    monthStart.setDate(1)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    const campAnalytics = await fetchInstantly(
      `/campaigns/analytics?start_date=${monthStartStr}&end_date=${endDate}`
    )

    if (Array.isArray(campAnalytics)) {
      for (const camp of campAnalytics) {
        if (camp.campaign_status !== 1) continue
        const campaignId = camp.campaign_id as string
        const apiOpps = (camp.total_opportunities as number) || 0

        // Sum daily opps for this campaign this month
        const { data: dailyRows } = await supabase
          .from('daily_analytics')
          .select('date, opportunities')
          .eq('campaign_id', campaignId)
          .gte('date', monthStartStr)

        const sumDailyOpps = dailyRows?.reduce(
          (s: number, r: { opportunities: number }) => s + (r.opportunities || 0), 0
        ) || 0

        if (sumDailyOpps !== apiOpps) {
          // Zero out all daily opps for this campaign
          await supabase
            .from('daily_analytics')
            .update({ opportunities: 0, unique_opportunities: 0 })
            .eq('campaign_id', campaignId)
            .gte('date', monthStartStr)

          // Set correct total on the most recent date
          if (apiOpps > 0 && dailyRows?.length) {
            const latestDate = dailyRows
              .map((r: { date: string }) => r.date)
              .sort()
              .pop()
            if (latestDate) {
              await supabase
                .from('daily_analytics')
                .update({ opportunities: apiOpps, unique_opportunities: apiOpps })
                .eq('campaign_id', campaignId)
                .eq('date', latestDate)
            }
          }
          oppsFixed++
        }
      }
    }
  }

  return { aggregateDays: aggDays, campaigns: activeCampaigns?.length || 0, oppsFixed }
}

async function syncReplyClassification(supabase: Supabase) {
  // Get current month boundaries
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthStartISO = `${monthStart}T00:00:00.000Z`
  const monthDate = monthStart // for upsert

  // Count unique leads by i_status for current month
  // Paginates desc, deduplicates by lead email, stops at month boundary
  // i_status: 1 = Positive, -1 = Not Interested, 0 = Neutral/OOO
  async function countUniqueLeads(iStatus: number): Promise<{ count: number; ooo: number }> {
    const leads = new Set<string>()
    const oooLeads = new Set<string>()
    let cursor: string | null = null
    let reachedPastMonth = false

    do {
      const params = new URLSearchParams({
        email_type: 'received',
        i_status: String(iStatus),
        limit: '100',
        sort_order: 'desc',
      })
      if (cursor) params.set('starting_after', cursor)
      const data = await fetchInstantly(`/emails?${params}`)
      const items = data.items || []
      if (!Array.isArray(items) || items.length === 0) break

      for (const email of items) {
        const ts = (email.timestamp_created || '') as string
        if (ts < monthStartISO) {
          reachedPastMonth = true
          break
        }
        const leadEmail = (email.lead || '') as string
        if (leadEmail) {
          leads.add(leadEmail)
          // Detect OOO from neutral email subjects
          if (iStatus === 0) {
            const subject = ((email.subject || '') as string).toLowerCase()
            if (
              subject.includes('automatic reply') ||
              subject.includes('out of office') ||
              subject.includes('auto-reply') ||
              subject.includes('autoreply') ||
              subject.includes('away from office') ||
              subject.includes('i am out of') ||
              subject.includes('on vacation') ||
              subject.includes('on leave')
            ) {
              oooLeads.add(leadEmail)
            }
          }
        }
      }

      cursor = data.next_starting_after || null
    } while (cursor && !reachedPastMonth)

    return { count: leads.size, ooo: oooLeads.size }
  }

  const [positiveResult, notInterestedResult, neutralResult] = await Promise.all([
    countUniqueLeads(1),
    countUniqueLeads(-1),
    countUniqueLeads(0),
  ])

  const positive = positiveResult.count
  const notInterested = notInterestedResult.count
  const neutral = neutralResult.count
  const ooo = neutralResult.ooo

  // Get current month's aggregate data from daily_analytics
  const { data: dailyData } = await supabase
    .from('daily_analytics')
    .select('new_leads_contacted, sent, unique_replies, unique_replies_automatic')
    .gte('date', monthStart)
    .is('campaign_id', null)

  const totalSent = dailyData?.reduce(
    (s: number, r: { sent: number }) => s + (r.sent || 0), 0
  ) || 0
  const totalContacted = dailyData?.reduce(
    (s: number, r: { new_leads_contacted: number }) => s + (r.new_leads_contacted || 0), 0
  ) || 0
  const totalReplies = dailyData?.reduce(
    (s: number, r: { unique_replies: number }) => s + (r.unique_replies || 0), 0
  ) || 0
  const totalAutoReplies = dailyData?.reduce(
    (s: number, r: { unique_replies_automatic: number }) => s + (r.unique_replies_automatic || 0), 0
  ) || 0

  const replyRate = totalContacted > 0 ? Math.round((totalReplies / totalContacted) * 10000) / 100 : 0
  const prr = totalReplies > 0 ? Math.round((positive / totalReplies) * 10000) / 100 : 0

  // Upsert current month into reporting_monthly
  const { error } = await supabase
    .from('reporting_monthly')
    .upsert({
      month: monthDate,
      total_email_sent: totalSent,
      total_lead_contacted: totalContacted,
      replies: totalReplies,
      reply_rate: replyRate,
      positive_replies: positive,
      prr,
      not_interested: notInterested,
      out_of_office: ooo,
      auto_replies: totalAutoReplies,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'month' })

  if (error) console.error('Reporting monthly upsert error:', error)

  return { positive, notInterested, neutral, ooo, totalReplies, replyRate, prr }
}

// Extract copy angle name from Instantly campaign name
// Pattern: "[W]C123 - US - AMZ Sellers - Copy Angle Name"
function extractCopyAngle(campaignName: string): string {
  const parts = campaignName.split(' - ')
  if (parts.length >= 4) {
    return parts.slice(3).join(' - ').trim()
  }
  if (parts.length === 3) {
    return parts[2].trim()
  }
  return campaignName.trim()
}

async function syncCopyAnglesMonthly(supabase: Supabase) {
  // Get all campaigns (active + completed)
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .in('status', [1, 2])

  if (!campaigns || campaigns.length === 0) return { synced: 0 }

  // Current month boundaries
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthDate = monthStart

  // Get existing copy angle names for matching
  const { data: caRows } = await supabase
    .from('copy_angles_monthly')
    .select('campaign_name')
    .eq('month', monthDate)
  const existingNames = new Set((caRows || []).map((r: { campaign_name: string }) => r.campaign_name))

  // Get daily_analytics for current month, per campaign
  const { data: dailyData } = await supabase
    .from('daily_analytics')
    .select('campaign_id, new_leads_contacted, unique_replies, unique_replies_automatic')
    .gte('date', monthStart)
    .not('campaign_id', 'is', null)

  if (!dailyData) return { synced: 0 }

  // Aggregate by campaign
  const byCampaign: Record<string, { contacted: number; replies: number; autoReplies: number }> = {}
  for (const row of dailyData) {
    if (!row.campaign_id) continue
    if (!byCampaign[row.campaign_id]) {
      byCampaign[row.campaign_id] = { contacted: 0, replies: 0, autoReplies: 0 }
    }
    byCampaign[row.campaign_id].contacted += row.new_leads_contacted || 0
    byCampaign[row.campaign_id].replies += row.unique_replies || 0
    byCampaign[row.campaign_id].autoReplies += row.unique_replies_automatic || 0
  }

  // Aggregate by copy angle name (multiple campaigns may share same copy angle)
  const byCopyAngle: Record<string, { contacted: number; replies: number; autoReplies: number }> = {}
  for (const camp of campaigns) {
    const data = byCampaign[camp.id]
    if (!data || data.contacted === 0) continue

    const caName = extractCopyAngle(camp.name)
    if (!byCopyAngle[caName]) {
      byCopyAngle[caName] = { contacted: 0, replies: 0, autoReplies: 0 }
    }
    byCopyAngle[caName].contacted += data.contacted
    byCopyAngle[caName].replies += data.replies
    byCopyAngle[caName].autoReplies += data.autoReplies
  }

  let synced = 0
  for (const [caName, data] of Object.entries(byCopyAngle)) {
    const replyRate = data.contacted > 0
      ? Math.round((data.replies / data.contacted) * 10000) / 100
      : 0

    if (existingNames.has(caName)) {
      // Update only API-computable fields, preserve positive_replies/booked_calls
      await supabase
        .from('copy_angles_monthly')
        .update({
          total_prospects: data.contacted,
          total_replies: data.replies,
          reply_rate: replyRate,
          auto_replies: data.autoReplies,
          updated_at: new Date().toISOString(),
        })
        .eq('month', monthDate)
        .eq('campaign_name', caName)
    } else {
      // Insert new row
      await supabase
        .from('copy_angles_monthly')
        .insert({
          month: monthDate,
          campaign_name: caName,
          total_prospects: data.contacted,
          total_replies: data.replies,
          reply_rate: replyRate,
          auto_replies: data.autoReplies,
        })
    }
    synced++
  }

  return { synced }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  try {
    const [campaigns, accounts, daily] = await Promise.all([
      syncCampaigns(supabase),
      syncAccounts(supabase),
      syncDailyAnalytics(supabase),
    ])

    // Reply classification runs after daily sync (needs fresh daily_analytics)
    const replyClassification = await syncReplyClassification(supabase)

    // Copy angles sync runs after daily sync
    const copyAngles = await syncCopyAnglesMonthly(supabase)

    const result = {
      ok: true,
      timestamp: new Date().toISOString(),
      campaigns,
      accounts,
      daily,
      replyClassification,
      copyAngles,
    }

    console.log('Sync completed:', result)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
