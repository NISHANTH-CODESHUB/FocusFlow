import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/auth'
import type { Profile, TablesUpdate } from '@/types/database'

export function useProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.profile,
    enabled: !!user,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (patch: TablesUpdate<'profiles'>) => {
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', user!.id).select().single()
      if (error) throw error
      // Keep auth metadata in sync so the name is available before the profile loads.
      if (patch.full_name !== undefined) await supabase.auth.updateUser({ data: { full_name: patch.full_name } })
      return data
    },
    onSuccess: (profile) => {
      qc.setQueryData(queryKeys.profile, profile)
      toast.success('Profile saved')
    },
  })
}

/** Display name: profile → auth metadata → email local part. */
export function useDisplayName(): string {
  const { user } = useAuth()
  const { data } = useProfile()
  const meta = user?.user_metadata?.full_name as string | undefined
  return data?.full_name || meta || user?.email?.split('@')[0] || 'Student'
}
