import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('your-project-ref'))

export const STORAGE_BUCKET = 'user-files'

export const supabase: SupabaseClient<Database> = createClient<Database>(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key-missing',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'studentos-auth',
    },
  },
)

/** Returns the signed-in user's id or throws — every storage write relies on it. */
export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (error || !id) throw new Error('Your session has expired. Please sign in again.')
  return id
}

/**
 * Untyped handle for generic helpers parameterised over the table name, where
 * supabase-js cannot resolve row types. Callers must type their results.
 */
export const untypedTable = (table: string) => (supabase as unknown as SupabaseClient).from(table)
