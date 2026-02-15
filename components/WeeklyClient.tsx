'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchWeeklyKPIs, fetchWeeklyCampaigns, fetchDailyAnalytics, fetchWarmupHealth } from '@/lib/queries'
import type { KPIData, CampaignRow, DailyDataPoint, WarmupHealth } from '@/lib/queries'
import KPICard from './KPICard'
import CampaignTable from './CampaignTable'
import DailyChart from './DailyChart'
import WarmupChart from './WarmupChart'
import ViewToggle from './ViewToggle'
import { KPISkeleton, TableSkeleton, ChartSkeleton } from './LoadingSkeleton'

export default function WeeklyClient({
  initialKPIs,
  initialCampaigns,
  initialDaily,
  initialWarmup,
}: {
  initialKPIs: KPIData
  initialCampaigns: CampaignRow[]
  initialDaily: DailyDataPoint[]
  initialWarmup: WarmupHealth
}) {
  const [kpis, setKpis] = useState(initialKPIs)
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [daily, setDaily] = useState(initialDaily)
  const [warmup, setWarmup] = useState(initialWarmup)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    // Pull live campaign totals from Instantly first
    try { await fetch('/api/refresh', { method: 'POST' }) } catch {}
    const supabase = createClient()
    const [k, c, d, w] = await Promise.all([
      fetchWeeklyKPIs(supabase),
      fetchWeeklyCampaigns(supabase),
      fetchDailyAnalytics(supabase, 7),
      fetchWarmupHealth(supabase),
    ])
    setKpis(k)
    setCampaigns(c)
    setDaily(d)
    setWarmup(w)
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    const interval = setInterval(refresh, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refresh])

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Weekly Overview</h1>
          <ViewToggle />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#6b7280' }}>
            Last updated: {lastRefresh.toLocaleTimeString('en-GB')}
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-white/5 disabled:opacity-50"
            style={{ color: '#94a3b8', borderColor: '#374151' }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading && !kpis.totalSent ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <KPISkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <KPICard
            title="Leads Contacted"
            value={kpis.totalSent.toLocaleString()}
            color="orange"
          />
          <KPICard
            title="Reply Rate"
            value={`${kpis.replyRate.toFixed(2)}%`}
            color="cyan"
            subtext={`${kpis.totalReplies.toLocaleString()} replies`}
          />
          <KPICard
            title="Opportunities"
            value={kpis.totalOpportunities.toLocaleString()}
            color="pink"
          />
          <KPICard
            title="Active Campaigns"
            value={kpis.activeCampaigns}
            color="green"
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {loading && daily.length === 0 ? <ChartSkeleton /> : <DailyChart data={daily} />}
        </div>
        <div>
          {loading && warmup.avgScore === 0 ? <ChartSkeleton /> : <WarmupChart data={warmup} />}
        </div>
      </div>

      {/* Campaign Table */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Campaign Performance</h2>
        {loading && campaigns.length === 0 ? <TableSkeleton /> : <CampaignTable campaigns={campaigns} />}
      </div>
    </div>
  )
}
