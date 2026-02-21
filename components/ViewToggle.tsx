'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const timeViews = [
  { href: '/dashboard', label: 'Monthly' },
  { href: '/dashboard/weekly', label: 'Weekly' },
]

export default function ViewToggle() {
  const pathname = usePathname()
  const isKPIs = pathname === '/dashboard/reporting'

  return (
    <div className="flex items-center gap-3">
      {/* Monthly / Weekly toggle */}
      <div
        className="inline-flex rounded-lg border p-0.5"
        style={{ borderColor: '#374151', background: '#111827' }}
      >
        {timeViews.map(({ href, label }) => {
          const isActive = !isKPIs && pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
              style={{
                background: isActive ? '#f97316' : 'transparent',
                color: isActive ? '#fff' : '#94a3b8',
              }}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* KPIs button — separate */}
      <Link
        href="/dashboard/reporting"
        className="px-4 py-1.5 rounded-lg border text-sm font-medium transition-all"
        style={{
          borderColor: isKPIs ? '#f97316' : '#374151',
          background: isKPIs ? '#f97316' : '#111827',
          color: isKPIs ? '#fff' : '#94a3b8',
        }}
      >
        KPIs
      </Link>
    </div>
  )
}
