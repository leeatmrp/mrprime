import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const INSTANTLY_API = 'https://api.instantly.ai/api/v2'
const INSTANTLY_KEY = process.env.INSTANTLY_API_KEY!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

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

async function syncDailyAnalytics(supabase: Supabase) {
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 8)
  const startDate = windowStart.toISOString().split('T')[0]
  const endDate = new Date().toISOString().split('T')[0]

  // 1. Aggregate daily analytics (last 8 days)
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

  // 2. Per-campaign daily analytics for active campaigns (parallel, last 8 days)
  const { data: activeCampaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('status', 1)

  let campaignsSynced = 0
  if (activeCampaigns && activeCampaigns.length > 0) {
    const batchSize = 10
    for (let i = 0; i < activeCampaigns.length; i += batchSize) {
      const batch = activeCampaigns.slice(i, i + batchSize)
      await Promise.all(batch.map(async (campaign: { id: string }) => {
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
          campaignsSynced++
        }
      }))
    }
  }

  return { aggDays, campaignsSynced }
}

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  try {
    const [campaigns, daily] = await Promise.all([
      syncCampaigns(supabase),
      syncDailyAnalytics(supabase),
    ])

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      campaigns,
      daily,
    })
  } catch (err) {
    console.error('Refresh error:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
