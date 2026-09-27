import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Trim and treat empty strings as missing: hosting dashboards often save blank values.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || undefined
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || undefined

export const isSupabaseConfigured = Boolean(url && anonKey && /^https?:\/\//.test(url) && !url.includes('your-project-ref'))

export const STORAGE_BUCKET = 'user-files'

// When unconfigured the app renders a setup screen and never calls this client,
// but it must still construct without throwing.
export const supabase: SupabaseClient<Database> = createClient<Database>(
  isSupabaseConfigured ? url! : 'http://localhost:54321',
  isSupabaseConfigured ? anonKey! : 'public-anon-key-missing',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'focusflow-auth',
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
