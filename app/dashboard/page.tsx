import { createClient } from '@/lib/supabase/server'
import { fetchKPIs, fetchCampaigns, fetchDailyAnalytics, fetchWarmupHealth } from '@/lib/queries'
import DashboardClient from '@/components/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  try {
    const [kpis, campaigns, daily, warmup] = await Promise.all([
      fetchKPIs(supabase),
      fetchCampaigns(supabase),
      fetchDailyAnalytics(supabase),
      fetchWarmupHealth(supabase),
    ])

    return (
      <DashboardClient
        initialKPIs={kpis}
        initialCampaigns={campaigns}
        initialDaily={daily}
        initialWarmup={warmup}
      />
    )
  } catch (err) {
    console.error('Dashboard data fetch error:', err)
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 text-lg font-semibold">Failed to load dashboard data</p>
        <pre className="mt-4 text-sm text-left max-w-2xl mx-auto p-4 rounded-lg overflow-auto" style={{ background: '#111827', color: '#94a3b8' }}>
          {err instanceof Error ? err.message : JSON.stringify(err, null, 2)}
        </pre>
      </div>
    )
  }
}
