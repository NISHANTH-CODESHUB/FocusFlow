import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { queryClient } from '@/lib/query'
import { supabase } from '@/lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  /** True after the user followed a password-recovery link. */
  recovering: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth
      .getSession()
      .then(({ data }) => active && setSession(data.session))
      .finally(() => active && setLoading(false))

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') {
        setRecovering(false)
        // Never leak one user's cached data into the next session.
        queryClient.clear()
      }
      if (event === 'USER_UPDATED') setRecovering(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, recovering, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
