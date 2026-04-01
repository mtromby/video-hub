import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { ManageDashboard } from '@/components/admin/ManageDashboard'
import { BottomNav, type AppTab } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { PerformersPage } from '@/pages/PerformersPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { ScrollPage } from '@/pages/ScrollPage'

function ManageTabPanel() {
  const { user, configured, signOut } = useAuth()
  const isAdmin = useIsAdmin()
  const location = useLocation()
  const loginReturnTo = `${location.pathname}${location.search}`

  if (!configured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
        <h1 className="text-xl font-semibold text-white">Manage</h1>
        <p className="max-w-sm text-sm text-zinc-400">
          Add Supabase environment variables to enable sign-in and the catalog admin.
        </p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
        <h1 className="text-xl font-semibold text-white">Manage</h1>
        <p className="max-w-sm text-sm text-zinc-400">
          Sign in as a catalog admin to edit videos, categories, and tags.
        </p>
        <Button asChild className="rounded-xl bg-white text-black hover:bg-zinc-200">
          <Link to="/login" state={{ from: loginReturnTo }}>
            Admin sign in
          </Link>
        </Button>
      </div>
    )
  }

  if (isAdmin === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-500">Checking access…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-xl font-semibold text-white">Manage</h1>
        <p className="max-w-sm text-sm text-zinc-400">
          You’re signed in, but this account is not in <code className="text-zinc-300">admin_users</code>
          , so catalog edits are blocked by RLS.
        </p>
        <p className="truncate text-xs text-zinc-500">{user.email}</p>
        <Button
          type="button"
          variant="outline"
          className="border-white/20 bg-transparent text-white hover:bg-white/10"
          onClick={() => void signOut()}
        >
          Sign out
        </Button>
      </div>
    )
  }

  return <ManageDashboard />
}

export function MainApp() {
  const [tab, setTab] = useState<AppTab>('scroll')

  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-lg flex-col bg-black">
      <main className="relative min-h-0 flex-1">
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
  )
}
