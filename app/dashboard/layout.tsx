import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value

  if (!token) {
    redirect('/login')
  }

  // Decode the JWT to get the email (payload is the second segment)
  let email = 'User'
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    email = payload.email || 'User'
  } catch {
    // ignore decode errors
  }

  return (
    <div className="min-h-screen">
      <header
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{
          background: 'linear-gradient(145deg, #1f2937, #111827)',
          borderColor: '#374151',
        }}
      >
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-2xl font-bold" style={{ color: '#f97316' }}>
            MrPrime
          </Link>
          <span className="text-sm" style={{ color: '#94a3b8' }}>
            Campaign Dashboard
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: '#6b7280' }}>
            {email}
          </span>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-white/5"
              style={{ color: '#94a3b8', borderColor: '#374151' }}
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>
      <main className="p-6 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  )
}
