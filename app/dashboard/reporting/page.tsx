import { createClient } from '@/lib/supabase/server'
import { fetchReportingMonthly } from '@/lib/queries'
import ReportingClient from '@/components/ReportingClient'

export const dynamic = 'force-dynamic'

export default async function ReportingPage() {
  const supabase = await createClient()

  try {
    const monthly = await fetchReportingMonthly(supabase)

    return <ReportingClient monthly={monthly} />
  } catch (err) {
    console.error('Reporting data fetch error:', err)
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 text-lg font-semibold">Failed to load reporting data</p>
        <pre className="mt-4 text-sm text-left max-w-2xl mx-auto p-4 rounded-lg overflow-auto" style={{ background: '#111827', color: '#94a3b8' }}>
          {err instanceof Error ? err.message : JSON.stringify(err, null, 2)}
        </pre>
      </div>
    )
  }
}
