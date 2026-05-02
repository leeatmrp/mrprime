// Backfill reporting_monthly + copy_angles_monthly for arbitrary months from daily_analytics.
// Preserves manually-tracked fields (positive_replies, booked_calls) on reporting_monthly,
// and on copy_angles_monthly when rows already exist.
//
// Usage:
//   node scripts/backfill_monthly.mjs 2026-03 2026-04
//   node scripts/backfill_monthly.mjs                 (defaults: prior 2 months)

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const envPath = join(here, '..', '.env.local')

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
)

const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
const SB_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function sb(path, init = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: init.method === 'POST' || init.method === 'PATCH' ? 'return=representation' : '',
      ...init.headers,
    },
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Supabase ${path}: ${res.status} ${txt}`)
  }
  if (res.status === 204 || res.status === 201) return null
  const txt = await res.text()
  if (!txt) return null
  try { return JSON.parse(txt) } catch { return null }
}

function monthBoundaries(ym) {
  const [y, m] = ym.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return { start, endExclusive: next }
}

function extractCopyAngle(name) {
  const parts = name.split(' - ')
  if (parts.length >= 4) return parts.slice(3).join(' - ').trim()
  if (parts.length === 3) return parts[2].trim()
  return name.trim()
}

async function getCampaigns() {
  const rows = await sb('campaigns?select=id,name,status&limit=10000')
  return rows
}

async function backfillMonth(ym, campaigns) {
  const { start, endExclusive } = monthBoundaries(ym)
  const monthDate = start
  console.log(`\n=== Backfilling ${ym} (${start} → ${endExclusive}) ===`)

  const capIds = new Set(
    campaigns.filter(c => /\bCAP\b/i.test(c.name)).map(c => c.id)
  )
  const campaignsById = new Map(campaigns.map(c => [c.id, c]))

  // Pull all per-campaign daily_analytics rows for the month
  const dailyData = await sb(
    `daily_analytics?select=campaign_id,sent,new_leads_contacted,unique_replies,unique_replies_automatic` +
      `&date=gte.${start}&date=lt.${endExclusive}&campaign_id=not.is.null&limit=20000`
  )

  // ---- reporting_monthly: non-CAP only ----
  const repTotals = { sent: 0, contacted: 0, replies: 0, autoReplies: 0 }
  for (const r of dailyData) {
    if (capIds.has(r.campaign_id)) continue
    repTotals.sent += r.sent || 0
    repTotals.contacted += r.new_leads_contacted || 0
    repTotals.replies += r.unique_replies || 0
    repTotals.autoReplies += r.unique_replies_automatic || 0
  }
  const replyRate = repTotals.contacted > 0
    ? Math.round((repTotals.replies / repTotals.contacted) * 10000) / 100
    : 0

  // Preserve existing positive_replies / booked_calls (manually maintained)
  const existing = await sb(
    `reporting_monthly?select=positive_replies,booked_calls,not_interested,out_of_office&month=eq.${monthDate}`
  )
  const prev = existing[0] || {}
  const positive = prev.positive_replies ?? 0
  const booked = prev.booked_calls ?? 0
  const notInterested = prev.not_interested ?? 0
  const ooo = prev.out_of_office ?? 0
  const prr = repTotals.replies > 0
    ? Math.round((positive / repTotals.replies) * 10000) / 100
    : 0
  const bookedRate = repTotals.replies > 0
    ? Math.round((booked / repTotals.replies) * 10000) / 100
    : 0

  await sb(`reporting_monthly?on_conflict=month`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      month: monthDate,
      total_email_sent: repTotals.sent,
      total_lead_contacted: repTotals.contacted,
      replies: repTotals.replies,
      reply_rate: replyRate,
      positive_replies: positive,
      prr,
      booked_calls: booked,
      booked_calls_rate: bookedRate,
      not_interested: notInterested,
      out_of_office: ooo,
      auto_replies: repTotals.autoReplies,
      updated_at: new Date().toISOString(),
    }),
  })
  console.log(`reporting_monthly[${monthDate}] non-CAP totals:`, {
    sent: repTotals.sent,
    contacted: repTotals.contacted,
    replies: repTotals.replies,
    auto: repTotals.autoReplies,
    reply_rate: replyRate,
    positive_preserved: positive,
    prr,
  })

  // ---- copy_angles_monthly: non-CAP campaigns only ----
  const byCopyAngle = {}
  for (const r of dailyData) {
    if (capIds.has(r.campaign_id)) continue
    const camp = campaignsById.get(r.campaign_id)
    if (!camp) continue
    const ca = extractCopyAngle(camp.name)
    if (!byCopyAngle[ca]) byCopyAngle[ca] = { contacted: 0, replies: 0, auto: 0 }
    byCopyAngle[ca].contacted += r.new_leads_contacted || 0
    byCopyAngle[ca].replies += r.unique_replies || 0
    byCopyAngle[ca].auto += r.unique_replies_automatic || 0
  }
  // Delete any existing CAP-named rows so prior runs don't leave stale data.
  // PostgREST in.() chokes on names with commas/colons/parens; use one DELETE per name.
  const capCampaignNames = [...new Set(
    campaigns.filter(c => capIds.has(c.id)).map(c => extractCopyAngle(c.name))
  )]
  for (const name of capCampaignNames) {
    await sb(
      `copy_angles_monthly?month=eq.${monthDate}&campaign_name=eq.${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    )
  }
  // Filter out empty copy angles (no contacted)
  const angles = Object.entries(byCopyAngle).filter(([, v]) => v.contacted > 0)

  // Pre-fetch existing rows so we can preserve positive_replies/booked_calls
  const existingCa = await sb(
    `copy_angles_monthly?select=campaign_name,positive_replies,booked_calls&month=eq.${monthDate}&limit=2000`
  )
  const prevCa = new Map(existingCa.map(r => [r.campaign_name, r]))

  let upserted = 0
  for (const [ca, data] of angles) {
    const rate = data.contacted > 0
      ? Math.round((data.replies / data.contacted) * 10000) / 100
      : 0
    const prevRow = prevCa.get(ca) || {}
    const positive = prevRow.positive_replies ?? 0
    const booked = prevRow.booked_calls ?? 0
    const caPrr = data.replies > 0
      ? Math.round((positive / data.replies) * 10000) / 100
      : 0
    const caBookedRate = data.replies > 0
      ? Math.round((booked / data.replies) * 10000) / 100
      : 0
    await sb(`copy_angles_monthly?on_conflict=month,campaign_name`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        month: monthDate,
        campaign_name: ca,
        total_prospects: data.contacted,
        total_replies: data.replies,
        reply_rate: rate,
        positive_replies: positive,
        prr: caPrr,
        booked_calls: booked,
        booked_calls_rate: caBookedRate,
        auto_replies: data.auto,
        updated_at: new Date().toISOString(),
      }),
    })
    upserted++
  }
  console.log(`copy_angles_monthly[${monthDate}]: ${upserted} rows upserted`)
}

const args = process.argv.slice(2)
let months = args
if (months.length === 0) {
  const now = new Date()
  for (let i = 1; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  months = months.reverse()
}

const campaigns = await getCampaigns()
console.log(`Loaded ${campaigns.length} campaigns`)
for (const ym of months) {
  await backfillMonth(ym, campaigns)
}
console.log('\nDone.')
