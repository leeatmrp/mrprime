'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function ViewToggle() {
  const pathname = usePathname()
  const isWeekly = pathname === '/dashboard/weekly'

  return (
    <div
      className="inline-flex rounded-lg border p-0.5"
      style={{ borderColor: '#374151', background: '#111827' }}
    >
      <Link
        href="/dashboard"
        className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
        style={{
          background: !isWeekly ? '#f97316' : 'transparent',
          color: !isWeekly ? '#fff' : '#94a3b8',
        }}
      >
        Monthly
      </Link>
      <Link
        href="/dashboard/weekly"
        className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
        style={{
          background: isWeekly ? '#f97316' : 'transparent',
          color: isWeekly ? '#fff' : '#94a3b8',
        }}
      >
        Weekly
      </Link>
    </div>
  )
}
