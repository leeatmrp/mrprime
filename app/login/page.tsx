'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-2xl border p-8"
        style={{
          background: 'linear-gradient(145deg, #1f2937, #111827)',
          borderColor: '#374151',
        }}
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: '#f97316' }}>
            MrPrime
          </h1>
          <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>
            Campaign Analytics Dashboard
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#94a3b8' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-orange-500"
              style={{
                background: '#111827',
                borderColor: '#374151',
              }}
              placeholder="you@mrprime.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#94a3b8' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-orange-500"
              style={{
                background: '#111827',
                borderColor: '#374151',
              }}
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p className="text-sm text-center" style={{ color: '#ef4444' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: '#f97316' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
