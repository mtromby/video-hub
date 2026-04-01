import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { ManageDashboard } from '@/components/admin/ManageDashboard'
import { BottomNav, BOTTOM_NAV_MAIN_PADDING, type AppTab } from '@/components/layout/BottomNav'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { cn } from '@/lib/utils'
import { PerformersPage } from '@/pages/PerformersPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { ScrollPage } from '@/pages/ScrollPage'

function ManageTabPanel() {
  const { user, configured, signOut } = useAuth()
  const isAdmin = useIsAdmin()
  const location = useLocation()
  const loginReturnTo = `${location.pathname}${location.search}`

  const themeCorner = (
    <div className="pointer-events-none fixed right-3 top-[max(0.5rem,env(safe-area-inset-top))] z-30">
      <ThemeToggle className="pointer-events-auto" />
    </div>
  )

  if (!configured) {
    return (
      <>
        {themeCorner}
        <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="max-w-xs space-y-3 rounded-3xl border border-border/80 bg-card/60 p-8 shadow-lg backdrop-blur-sm">
            <h1 className="text-xl font-light tracking-tight text-foreground">Manage</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Add Supabase environment variables to enable sign-in and the catalog admin.
            </p>
          </div>
        </div>
      </>
    )
  }

  if (!user) {
    return (
      <>
        {themeCorner}
        <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="max-w-sm space-y-6 rounded-3xl border border-border/80 bg-card/70 p-10 shadow-xl backdrop-blur-md">
            <h1 className="text-2xl font-light tracking-tight text-foreground">Catalog admin</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sign in as a catalog admin to edit videos, categories, and tags.
            </p>
            <Button asChild className="w-full">
              <Link to="/login" state={{ from: loginReturnTo }}>
                Admin sign in
              </Link>
            </Button>
          </div>
        </div>
      </>
    )
  }

  if (isAdmin === null) {
    return (
      <>
        {themeCorner}
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">Checking access…</p>
        </div>
      </>
    )
  }

  if (!isAdmin) {
    return (
      <>
        {themeCorner}
        <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="max-w-md space-y-4 rounded-3xl border border-border/80 bg-card/70 p-8 shadow-lg backdrop-blur-sm">
            <h1 className="text-xl font-light text-foreground">Access restricted</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You’re signed in, but this account is not in{' '}
              <code className="rounded-md bg-muted px-1.5 py-0.5 text-foreground/90">admin_users</code>
              , so catalog edits are blocked by RLS.
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <Button type="button" variant="outline" className="w-full" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </>
    )
  }

  return <ManageDashboard />
}

export function MainApp() {
  const [tab, setTab] = useState<AppTab>('scroll')

  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-lg flex-col bg-background">
      <div className="app-atmosphere" aria-hidden />
      <div className="app-content-layer relative flex min-h-0 flex-1 flex-col">
        {tab === 'scroll' ? (
          <div className="pointer-events-none fixed right-3 top-[max(0.5rem,env(safe-area-inset-top))] z-30">
            <ThemeToggle className="pointer-events-auto" />
          </div>
        ) : null}
        <main className={cn('relative min-h-0 flex-1', BOTTOM_NAV_MAIN_PADDING)}>
          {tab === 'scroll' ? <ScrollPage /> : null}
          {tab === 'performers' ? <PerformersPage /> : null}
          {tab === 'library' ? (
            <PlaceholderPage
              title="Library"
              description="Saved clips and playlists will live here in a future iteration."
            />
          ) : null}
          {tab === 'manage' ? <ManageTabPanel /> : null}
        </main>

        <BottomNav active={tab} onChange={setTab} />
      </div>
    </div>
  )
}
