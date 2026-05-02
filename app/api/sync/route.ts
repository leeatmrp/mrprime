import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const INSTANTLY_API = 'https://api.instantly.ai/api/v2'
const INSTANTLY_KEY = process.env.INSTANTLY_API_KEY!
const CRON_SECRET = process.env.CRON_SECRET!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

// Filter noise from reply classification: Close CRM notifications and MrPrime outbound replies
const MRPRIME_DOMAINS = new Set(['mrprime.com', 'youragentai.com', 'tryyouraiagents.com',
  'capcreatoragency.com', 'creatoragencynetwork.com', 'pureconnectonline.co'])

function isNoiseEmail(email: Record<string, unknown>): boolean {
  const fromEmail = (email.from_address_email || '') as string
  const fromDomain = fromEmail.includes('@') ? fromEmail.split('@').pop()! : ''
  // Close CRM system notifications
  if (fromDomain === 'close.com') return true
  // MrPrime's own outbound replies captured as received
  if (MRPRIME_DOMAINS.has(fromDomain)) return true
  return false
}

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

  // 2. Per-campaign daily analytics for active, completed, and paused campaigns
  const { data: activeCampaigns } = await supabase
    .from('campaigns')
    .select('id')
    .in('status', [1, 2, 3])

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
  let repliesFixed = 0
  if (activeCampaigns) {
    const monthStart = new Date()
    monthStart.setDate(1)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    const campAnalytics = await fetchInstantly(
      `/campaigns/analytics?start_date=${monthStartStr}&end_date=${endDate}`
    )

    if (Array.isArray(campAnalytics)) {
      for (const camp of campAnalytics) {
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

      // 4. Reconcile replies against campaign analytics (source of truth)
      // Daily unique_replies are per-day unique — summing across days inflates the count.
      // Campaign analytics reply_count_unique is the true unique count for the period.
      for (const camp of campAnalytics) {
        const campaignId = camp.campaign_id as string
        const apiReplies = (camp.reply_count_unique as number) ?? (camp.reply_count as number) ?? 0
        const apiAutoReplies = (camp.reply_count_automatic_unique as number) ?? (camp.reply_count_automatic as number) ?? 0

        const { data: dailyReplyRows } = await supabase
          .from('daily_analytics')
          .select('date, unique_replies, unique_replies_automatic')
          .eq('campaign_id', campaignId)
          .gte('date', monthStartStr)

        const sumDailyReplies = dailyReplyRows?.reduce(
          (s: number, r: { unique_replies: number }) => s + (r.unique_replies || 0), 0
        ) || 0
        const sumDailyAutoReplies = dailyReplyRows?.reduce(
          (s: number, r: { unique_replies_automatic: number }) => s + (r.unique_replies_automatic || 0), 0
        ) || 0

        if (sumDailyReplies !== apiReplies || sumDailyAutoReplies !== apiAutoReplies) {
          // Zero out all daily replies for this campaign this month
          await supabase
            .from('daily_analytics')
            .update({
              unique_replies: 0,
              replies: 0,
              unique_replies_automatic: 0,
              replies_automatic: 0,
            })
            .eq('campaign_id', campaignId)
            .gte('date', monthStartStr)

          // Set correct totals on the most recent date
          if ((apiReplies > 0 || apiAutoReplies > 0) && dailyReplyRows?.length) {
            const latestDate = dailyReplyRows
              .map((r: { date: string }) => r.date)
              .sort()
              .pop()
            if (latestDate) {
              await supabase
                .from('daily_analytics')
                .update({
                  unique_replies: apiReplies,
                  replies: apiReplies,
                  unique_replies_automatic: apiAutoReplies,
                  replies_automatic: apiAutoReplies,
                })
                .eq('campaign_id', campaignId)
                .eq('date', latestDate)
            }
          }
          repliesFixed++
        }
      }
    }
  }

  return { aggregateDays: aggDays, campaigns: activeCampaigns?.length || 0, oppsFixed, repliesFixed }
}

async function syncReplyClassification(supabase: Supabase) {
  // Get current month boundaries
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthStartISO = `${monthStart}T00:00:00.000Z`
  const monthDate = monthStart // for upsert

  // Get CAP campaign IDs to exclude from reporting_monthly KPIs
  const { data: allCampaigns } = await supabase.from('campaigns').select('id, name')
  const capCampaignIds = new Set(
    (allCampaigns || []).filter((c: { name: string }) => /\bCAP\b/i.test(c.name)).map((c: { id: string }) => c.id)
  )

  // Count unique leads by i_status for current month
  // Paginates desc, deduplicates by lead email, stops at month boundary
  // i_status: 1 = Positive, -1 = Not Interested, 0 = Neutral/OOO
  // Also tracks per-campaign counts for positive replies (used by copy angles)
  // Returns separate non-CAP counts for reporting_monthly KPIs
  async function countUniqueLeads(iStatus: number): Promise<{ count: number; nonCapCount: number; ooo: number; nonCapOoo: number; byCampaign: Record<string, number> }> {
    const leads = new Set<string>()
    const nonCapLeads = new Set<string>()
    const oooLeads = new Set<string>()
    const nonCapOooLeads = new Set<string>()
    // Track unique leads per campaign (lead may reply to multiple campaigns)
    const campaignLeads: Record<string, Set<string>> = {}
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
        // Skip noise: Close CRM notifications, MrPrime outbound replies
        if (isNoiseEmail(email)) continue
        const leadEmail = (email.lead || '') as string
        if (leadEmail) {
          leads.add(leadEmail)
          // Track per-campaign
          const campId = (email.campaign_id || '') as string
          if (campId) {
            if (!campaignLeads[campId]) campaignLeads[campId] = new Set()
            campaignLeads[campId].add(leadEmail)
            // Track non-CAP leads separately for reporting KPIs
            if (!capCampaignIds.has(campId)) {
              nonCapLeads.add(leadEmail)
            }
          }
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
              if (campId && !capCampaignIds.has(campId)) {
                nonCapOooLeads.add(leadEmail)
              }
            }
          }
        }
      }

      cursor = data.next_starting_after || null
    } while (cursor && !reachedPastMonth)

    // Convert Sets to counts
    const byCampaign: Record<string, number> = {}
    for (const [campId, leadSet] of Object.entries(campaignLeads)) {
      byCampaign[campId] = leadSet.size
    }

    return { count: leads.size, nonCapCount: nonCapLeads.size, ooo: oooLeads.size, nonCapOoo: nonCapOooLeads.size, byCampaign }
  }

  const [positiveResult, notInterestedResult, neutralResult] = await Promise.all([
    countUniqueLeads(1),
    countUniqueLeads(-1),
    countUniqueLeads(0),
  ])

  // Use non-CAP counts for reporting_monthly KPIs
  const positive = positiveResult.nonCapCount
  const notInterested = notInterestedResult.nonCapCount
  const neutral = neutralResult.nonCapCount
  const ooo = neutralResult.nonCapOoo

  // Get current month's per-campaign data from daily_analytics (excluding CAP)
  const capIdArray = Array.from(capCampaignIds)
  let dailyQuery = supabase
    .from('daily_analytics')
    .select('new_leads_contacted, sent, unique_replies, unique_replies_automatic')
    .gte('date', monthStart)
    .not('campaign_id', 'is', null)
  if (capIdArray.length > 0) {
    dailyQuery = dailyQuery.not('campaign_id', 'in', `(${capIdArray.join(',')})`)
  }
  const { data: dailyData } = await dailyQuery

  const totalSent = dailyData?.reduce(
    (s: number, r: { sent: number }) => s + (r.sent || 0), 0
  ) || 0
  const totalContacted = dailyData?.reduce(
    (s: number, r: { new_leads_contacted: number }) => s + (r.new_leads_contacted || 0), 0
  ) || 0
  const totalAutoReplies = dailyData?.reduce(
    (s: number, r: { unique_replies_automatic: number }) => s + (r.unique_replies_automatic || 0), 0
  ) || 0

  // Use daily_analytics unique_replies (human-only) for total replies count.
  // The classification counts (positive + notInterested + neutral) include auto-replies
  // classified as i_status=0 (neutral), which massively inflates the total.
  const totalReplies = dailyData?.reduce(
    (s: number, r: { unique_replies: number }) => s + (r.unique_replies || 0), 0
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

  // Update per-campaign positive replies in campaigns table
  const positiveByCampaignAll = positiveResult.byCampaign
  for (const [campId, posCount] of Object.entries(positiveByCampaignAll)) {
    await supabase
      .from('campaigns')
      .update({ positive_replies: posCount })
      .eq('id', campId)
  }
  // Zero out campaigns with no positive replies this month
  const campIdsWithPositives = Object.keys(positiveByCampaignAll)
  if (campIdsWithPositives.length > 0) {
    await supabase
      .from('campaigns')
      .update({ positive_replies: 0 })
      .not('id', 'in', `(${campIdsWithPositives.join(',')})`)
  }

  // Update copy_angles_monthly with per-campaign classification data
  // Use ALL classifications (positive + notInterested + neutral) as total_replies
  // This ensures PRR = positive / total is internally consistent
  const positiveByCampaign = positiveResult.byCampaign
  const notInterestedByCampaign = notInterestedResult.byCampaign
  const neutralByCampaign = neutralResult.byCampaign

  // Collect all campaign IDs across all classifications
  const allClassifiedCampIds = new Set([
    ...Object.keys(positiveByCampaign),
    ...Object.keys(notInterestedByCampaign),
    ...Object.keys(neutralByCampaign),
  ])

  if (allClassifiedCampIds.size > 0) {
    const { data: campRows } = await supabase
      .from('campaigns')
      .select('id, name')
      .in('id', Array.from(allClassifiedCampIds))

    if (campRows && campRows.length > 0) {
      // Aggregate all classifications by copy angle name
      const positiveByAngle: Record<string, number> = {}
      const totalRepliesByAngle: Record<string, number> = {}
      for (const camp of campRows) {
        const caName = extractCopyAngle(camp.name)
        const pos = positiveByCampaign[camp.id] || 0
        const neg = notInterestedByCampaign[camp.id] || 0
        const neu = neutralByCampaign[camp.id] || 0
        positiveByAngle[caName] = (positiveByAngle[caName] || 0) + pos
        totalRepliesByAngle[caName] = (totalRepliesByAngle[caName] || 0) + pos + neg + neu
      }

      // Update each copy angle row with classification-based totals
      for (const caName of Object.keys(totalRepliesByAngle)) {
        const posCount = positiveByAngle[caName] || 0
        const classifiedTotal = totalRepliesByAngle[caName] || 0
        const caPrr = classifiedTotal > 0
          ? Math.round((posCount / classifiedTotal) * 10000) / 100
          : 0

        // Check if copy angle row exists
        const { data: caRow } = await supabase
          .from('copy_angles_monthly')
          .select('total_replies')
          .eq('month', monthDate)
          .eq('campaign_name', caName)
          .single()

        if (caRow) {
          // Use the HIGHER of daily_analytics total_replies or classification total
          // Classification total is authoritative for PRR, but daily_analytics may catch
          // replies not yet classified
          const finalReplies = Math.max(caRow.total_replies, classifiedTotal)
          const finalPrr = finalReplies > 0
            ? Math.round((posCount / finalReplies) * 10000) / 100
            : 0
          await supabase
            .from('copy_angles_monthly')
            .update({
              total_replies: finalReplies,
              positive_replies: posCount,
              prr: finalPrr,
              updated_at: new Date().toISOString(),
            })
            .eq('month', monthDate)
            .eq('campaign_name', caName)
        }
      }
    }
  }

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
  // Get all campaigns (active + completed + paused)
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .in('status', [1, 2, 3])

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

// Refresh reporting_monthly + copy_angles_monthly for the prior N months from
// daily_analytics. Preserves positive_replies/booked_calls (manually maintained).
// Skips Instantly classification API calls (heavy + only applicable to current month).
async function refreshPastMonths(supabase: Supabase, monthsBack: number) {
  const now = new Date()
  const months: { start: string; endExclusive: string }[] = []
  for (let i = 1; i <= monthsBack; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    months.push({ start: fmt(start), endExclusive: fmt(end) })
  }

  const { data: allCampaigns } = await supabase.from('campaigns').select('id, name')
  const campaigns = allCampaigns || []
  const capIds = new Set(campaigns.filter((c: { name: string }) => /\bCAP\b/i.test(c.name)).map((c: { id: string }) => c.id))
  const campaignsById = new Map(campaigns.map((c: { id: string; name: string }) => [c.id, c]))

  const summary: { month: string; reporting: { sent: number; replies: number }; angles: number }[] = []

  for (const { start, endExclusive } of months) {
    let dailyQuery = supabase
      .from('daily_analytics')
      .select('campaign_id, sent, new_leads_contacted, unique_replies, unique_replies_automatic')
      .gte('date', start)
      .lt('date', endExclusive)
      .not('campaign_id', 'is', null)
    const { data: dailyData } = await dailyQuery
    const rows = dailyData || []

    // reporting_monthly: non-CAP only
    const rep = { sent: 0, contacted: 0, replies: 0, autoReplies: 0 }
    for (const r of rows) {
      if (capIds.has(r.campaign_id)) continue
      rep.sent += r.sent || 0
      rep.contacted += r.new_leads_contacted || 0
      rep.replies += r.unique_replies || 0
      rep.autoReplies += r.unique_replies_automatic || 0
    }
    const replyRate = rep.contacted > 0
      ? Math.round((rep.replies / rep.contacted) * 10000) / 100
      : 0
    const { data: prevRep } = await supabase
      .from('reporting_monthly')
      .select('positive_replies, booked_calls, not_interested, out_of_office')
      .eq('month', start)
      .maybeSingle()
    const positive = prevRep?.positive_replies ?? 0
    const booked = prevRep?.booked_calls ?? 0
    const notInterested = prevRep?.not_interested ?? 0
    const ooo = prevRep?.out_of_office ?? 0
    const prr = rep.replies > 0 ? Math.round((positive / rep.replies) * 10000) / 100 : 0
    const bookedRate = rep.replies > 0 ? Math.round((booked / rep.replies) * 10000) / 100 : 0
    await supabase
      .from('reporting_monthly')
      .upsert({
        month: start,
        total_email_sent: rep.sent,
        total_lead_contacted: rep.contacted,
        replies: rep.replies,
        reply_rate: replyRate,
        positive_replies: positive,
        prr,
        booked_calls: booked,
        booked_calls_rate: bookedRate,
        not_interested: notInterested,
        out_of_office: ooo,
        auto_replies: rep.autoReplies,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'month' })

    // copy_angles_monthly: ALL campaigns (CAP included), grouped by copy angle
    const byAngle: Record<string, { contacted: number; replies: number; auto: number }> = {}
    for (const r of rows) {
      const camp = campaignsById.get(r.campaign_id) as { name: string } | undefined
      if (!camp) continue
      const ca = extractCopyAngle(camp.name)
      if (!byAngle[ca]) byAngle[ca] = { contacted: 0, replies: 0, auto: 0 }
      byAngle[ca].contacted += r.new_leads_contacted || 0
      byAngle[ca].replies += r.unique_replies || 0
      byAngle[ca].auto += r.unique_replies_automatic || 0
    }
    const { data: existingCa } = await supabase
      .from('copy_angles_monthly')
      .select('campaign_name, positive_replies, booked_calls')
      .eq('month', start)
    const prevCa = new Map((existingCa || []).map((r: { campaign_name: string; positive_replies: number; booked_calls: number }) => [r.campaign_name, r]))

    let upserted = 0
    for (const [ca, data] of Object.entries(byAngle)) {
      if (data.contacted === 0) continue
      const rate = data.contacted > 0 ? Math.round((data.replies / data.contacted) * 10000) / 100 : 0
      const prevRow = prevCa.get(ca) as { positive_replies?: number; booked_calls?: number } | undefined
      const pos = prevRow?.positive_replies ?? 0
      const bk = prevRow?.booked_calls ?? 0
      const caPrr = data.replies > 0 ? Math.round((pos / data.replies) * 10000) / 100 : 0
      const caBookedRate = data.replies > 0 ? Math.round((bk / data.replies) * 10000) / 100 : 0
      await supabase
        .from('copy_angles_monthly')
        .upsert({
          month: start,
          campaign_name: ca,
          total_prospects: data.contacted,
          total_replies: data.replies,
          reply_rate: rate,
          positive_replies: pos,
          prr: caPrr,
          booked_calls: bk,
          booked_calls_rate: caBookedRate,
          auto_replies: data.auto,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'month,campaign_name' })
      upserted++
    }

    summary.push({ month: start, reporting: { sent: rep.sent, replies: rep.replies }, angles: upserted })
  }

  return summary
}

async function syncReportingWeekly(supabase: Supabase) {
  // Current week: Monday to today
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - mondayOffset)
  const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
  const weekStartISO = `${weekStart}T00:00:00.000Z`

  // Get CAP campaign IDs
  const { data: allCampaigns } = await supabase.from('campaigns').select('id, name')
  const capIds = new Set(
    (allCampaigns || []).filter((c: { name: string }) => /\bCAP\b/i.test(c.name)).map((c: { id: string }) => c.id)
  )
  const capIdArray = Array.from(capIds)

  // Get daily_analytics for the week (excluding CAP)
  let dailyQuery = supabase
    .from('daily_analytics')
    .select('new_leads_contacted, sent, unique_replies, unique_replies_automatic')
    .gte('date', weekStart)
    .not('campaign_id', 'is', null)
  if (capIdArray.length > 0) {
    dailyQuery = dailyQuery.not('campaign_id', 'in', `(${capIdArray.join(',')})`)
  }
  const { data: dailyData } = await dailyQuery

  const totalSent = dailyData?.reduce(
    (s: number, r: { sent: number }) => s + (r.sent || 0), 0
  ) || 0
  const totalContacted = dailyData?.reduce(
    (s: number, r: { new_leads_contacted: number }) => s + (r.new_leads_contacted || 0), 0
  ) || 0

  // Count replies by classification for this week (excluding CAP + noise)
  async function countWeekLeads(iStatus: number): Promise<number> {
    const leads = new Set<string>()
    let cursor: string | null = null
    let done = false

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
        if (ts < weekStartISO) { done = true; break }
        if (isNoiseEmail(email)) continue
        const campId = (email.campaign_id || '') as string
        if (campId && capIds.has(campId)) continue
        const leadEmail = (email.lead || '') as string
        if (leadEmail) leads.add(leadEmail)
      }

      cursor = data.next_starting_after || null
    } while (cursor && !done)

    return leads.size
  }

  const [positive, notInterested, neutral] = await Promise.all([
    countWeekLeads(1),
    countWeekLeads(-1),
    countWeekLeads(0),
  ])

  // Use daily_analytics unique_replies (human-only) for total replies.
  // Classification counts include auto-replies in neutral (i_status=0).
  const totalReplies = dailyData?.reduce(
    (s: number, r: { unique_replies: number }) => s + (r.unique_replies || 0), 0
  ) || 0
  const replyRate = totalContacted > 0 ? Math.round((totalReplies / totalContacted) * 10000) / 100 : 0
  const prr = totalReplies > 0 ? Math.round((positive / totalReplies) * 10000) / 100 : 0

  const { error } = await supabase
    .from('reporting_weekly')
    .upsert({
      week_start: weekStart,
      total_email_sent: totalSent,
      total_lead_contacted: totalContacted,
      replies: totalReplies,
      reply_rate: replyRate,
      positive_replies: positive,
      prr,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'week_start' })

  if (error) console.error('Reporting weekly upsert error:', error)

  return { weekStart, totalContacted, totalReplies, positive, prr }
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

    // Roll prior 2 months forward from daily_analytics so late-arriving replies/sends
    // don't leave reporting_monthly + copy_angles_monthly frozen at end-of-month snapshot.
    // Preserves manually-tracked positive_replies/booked_calls.
    const pastMonths = await refreshPastMonths(supabase, 2)

    // Weekly reporting sync
    const reportingWeekly = await syncReportingWeekly(supabase)

    const result = {
      ok: true,
      timestamp: new Date().toISOString(),
      campaigns,
      accounts,
      daily,
      replyClassification,
      reportingWeekly,
      copyAngles,
      pastMonths,
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
