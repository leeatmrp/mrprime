import { createClient } from '@/lib/supabase/server'
import { fetchWeeklyKPIs, fetchCampaigns, fetchDailyAnalytics, fetchWarmupHealth } from '@/lib/queries'
import WeeklyClient from '@/components/WeeklyClient'

export const dynamic = 'force-dynamic'

export default async function WeeklyPage() {
  const supabase = await createClient()

  try {
    const [kpis, campaigns, daily, warmup] = await Promise.all([
      fetchWeeklyKPIs(supabase),
      fetchCampaigns(supabase),
      fetchDailyAnalytics(supabase, 7),
      fetchWarmupHealth(supabase),
    ])

    return (
      <WeeklyClient
        initialKPIs={kpis}
        initialCampaigns={campaigns}
        initialDaily={daily}
        initialWarmup={warmup}
      />
    )
  } catch (err) {
    console.error('Weekly data fetch error:', err)
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 text-lg font-semibold">Failed to load weekly data</p>
        <pre className="mt-4 text-sm text-left max-w-2xl mx-auto p-4 rounded-lg overflow-auto" style={{ background: '#111827', color: '#94a3b8' }}>
          {err instanceof Error ? err.message : JSON.stringify(err, null, 2)}
        </pre>
      </div>
    )
  }
}
