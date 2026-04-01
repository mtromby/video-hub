import { useEffect, useState } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { getSupabase } from '@/lib/supabase'

/**
 * Whether the signed-in user is in public.admin_users (RLS: only admins can read the table).
 */
export function useIsAdmin(): boolean | null {
  const { user, configured } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!configured || !user) {
      const t = window.setTimeout(() => setIsAdmin(null), 0)
      return () => window.clearTimeout(t)
    }
    const supabase = getSupabase()
    if (!supabase) {
      const t = window.setTimeout(() => setIsAdmin(null), 0)
      return () => window.clearTimeout(t)
    }

    let cancelled = false
    supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setIsAdmin(false)
          return
        }
        setIsAdmin(Boolean(data))
      })

    return () => {
      cancelled = true
    }
  }, [configured, user])

  return isAdmin
}
