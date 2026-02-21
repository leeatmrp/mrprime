import { createClient } from '@/lib/supabase/server'
import { fetchCopyAnglesMonthly } from '@/lib/queries'
import CopyAnglesClient from '@/components/CopyAnglesClient'

export const dynamic = 'force-dynamic'

export default async function CopyAnglesPage() {
  const supabase = await createClient()

  try {
    const data = await fetchCopyAnglesMonthly(supabase)

    return <CopyAnglesClient data={data} />
  } catch (err) {
    console.error('Copy angles data fetch error:', err)
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 text-lg font-semibold">Failed to load copy angles data</p>
        <pre className="mt-4 text-sm text-left max-w-2xl mx-auto p-4 rounded-lg overflow-auto" style={{ background: '#111827', color: '#94a3b8' }}>
          {err instanceof Error ? err.message : JSON.stringify(err, null, 2)}
        </pre>
      </div>
    )
  }
}
