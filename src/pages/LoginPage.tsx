import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { getSupabase } from '@/lib/supabase'
import { safeAppRedirectPath } from '@/lib/safe-redirect-path'

export function LoginPage() {
  const { session, loading, configured } = useAuth()
  const location = useLocation()
  const from = safeAppRedirectPath((location.state as { from?: unknown } | null)?.from)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!configured) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black px-6 text-center">
        <h1 className="text-lg font-semibold text-white">Sign in unavailable</h1>
        <p className="max-w-sm text-sm text-zinc-400">
          Set <code className="text-zinc-300">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-zinc-300">VITE_SUPABASE_ANON_KEY</code> in your environment,
          then restart the dev server.
        </p>
        <Button asChild variant="outline" className="border-white/20 bg-transparent text-white">
          <Link to="/">Back</Link>
        </Button>
      </div>
    )
  }

  if (!loading && session) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = getSupabase()
    if (!supabase) return

    setSubmitting(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-black">
      <div className="flex flex-1 flex-col justify-center px-6 pb-24">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-white">Admin sign in</h1>
            <p className="text-sm text-zinc-500">Use your Supabase Auth credentials.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-xs font-medium text-zinc-400">
                Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-600 outline-none ring-white/20 focus-visible:ring-2"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="login-password" className="text-xs font-medium text-zinc-400">
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-600 outline-none ring-white/20 focus-visible:ring-2"
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={submitting || loading}
              className="h-11 w-full rounded-xl bg-white text-black hover:bg-zinc-200"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-500">
            <Link to="/" className="text-zinc-300 underline-offset-4 hover:underline">
              Back to app
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
