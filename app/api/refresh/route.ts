import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const INSTANTLY_API = 'https://api.instantly.ai/api/v2'
const INSTANTLY_KEY = process.env.INSTANTLY_API_KEY!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET() {
  try {
    const res = await fetch(`${INSTANTLY_API}/campaigns/analytics`, {
      headers: {
        'Authorization': `Bearer ${INSTANTLY_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Instantly: ${res.status} ${res.statusText}`)
    const analytics = await res.json()

    if (!analytics || !Array.isArray(analytics)) {
      return NextResponse.json({ ok: true, synced: 0 })
    }

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const { error } = await supabase
      .from('campaigns')
      .upsert(rows, { onConflict: 'id' })

    if (error) throw new Error(`Upsert: ${error.message}`)

    return NextResponse.json({ ok: true, synced: rows.length, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('Refresh error:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
