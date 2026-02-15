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

    const result = {
      ok: true,
      timestamp: new Date().toISOString(),
      campaigns,
      accounts,
      daily,
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
