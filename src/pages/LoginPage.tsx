import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { ThemeToggle } from '@/components/layout/ThemeToggle'
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
      <div className="relative flex min-h-dvh flex-col bg-background">
        <div className="app-atmosphere" aria-hidden />
        <div className="app-content-layer relative flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-10">
            <ThemeToggle />
          </div>
          <div className="max-w-md space-y-5 rounded-3xl border border-border/80 bg-card/80 p-10 shadow-2xl backdrop-blur-md">
            <h1 className="text-2xl font-light tracking-tight text-foreground">Sign in unavailable</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Set <code className="rounded-md bg-muted px-1.5 py-0.5 text-foreground">VITE_SUPABASE_URL</code> and{' '}
              <code className="rounded-md bg-muted px-1.5 py-0.5 text-foreground">VITE_SUPABASE_ANON_KEY</code> in
              your environment, then restart the dev server.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Back</Link>
            </Button>
          </div>
        </div>
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

  const inputClass =
    'h-12 w-full rounded-2xl border-2 border-input bg-card/90 px-4 text-sm text-foreground shadow-inner shadow-foreground/[0.02] placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30'

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div className="app-atmosphere" aria-hidden />
      <div className="app-content-layer relative flex flex-1 flex-col">
        <div className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-10">
          <ThemeToggle />
        </div>
        <div className="flex flex-1 flex-col justify-center px-6 py-16 pb-28">
          <div className="mx-auto w-full max-w-sm">
            <div className="overflow-hidden rounded-[1.75rem] border border-border/80 bg-card/85 shadow-2xl shadow-foreground/10 backdrop-blur-xl dark:shadow-black/50">
              <div className="h-1.5 bg-gradient-to-r from-primary/80 via-primary to-primary/60" aria-hidden />
              <div className="space-y-8 px-8 py-10">
                <div className="space-y-2 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
                    Catalog
                  </p>
                  <h1 className="text-2xl font-light tracking-tight text-foreground">Admin sign in</h1>
                  <p className="text-sm text-muted-foreground">Supabase Auth credentials</p>
                </div>

                <form onSubmit={onSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="login-email" className="text-xs font-medium text-muted-foreground">
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
                      className={inputClass}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="login-password" className="text-xs font-medium text-muted-foreground">
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
                      className={inputClass}
                      placeholder="••••••••"
                    />
                  </div>

                  {error ? (
                    <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <Button type="submit" disabled={submitting || loading} className="h-12 w-full text-base">
                    {submitting ? 'Signing in…' : 'Sign in'}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                  <Link
                    to="/"
                    className="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    Back to app
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
