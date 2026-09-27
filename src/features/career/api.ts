import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchAll, queryKeys } from '@/lib/query'
import { supabase, untypedTable } from '@/lib/supabase'
import type { Achievement, Skill, SkillLevel, TablesInsert } from '@/types/database'

export const SKILL_LEVELS: ReadonlyArray<{ value: SkillLevel; label: string }> = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
]

export const SKILL_AREAS = ['Language', 'Frontend', 'Backend', 'Database', 'DevOps & Cloud', 'AI / ML', 'Core CS', 'Tools', 'Soft skill', 'Other']

export const ACHIEVEMENT_KINDS = ['Award', 'Competition', 'Scholarship', 'Publication', 'Open source', 'Leadership', 'Academic', 'Other']

export function useSkills() {
  return useQuery({
    queryKey: queryKeys.skills,
    queryFn: () => fetchAll<Skill>((f, t) => supabase.from('skills').select('*').order('area').order('name').order('id').range(f, t)),
  })
}

export function useAchievements() {
  return useQuery({
    queryKey: queryKeys.achievements,
    queryFn: () =>
      fetchAll<Achievement>((f, t) =>
        supabase.from('achievements').select('*').order('achieved_on', { ascending: false }).order('id').range(f, t),
      ),
  })
}

/** Shared CRUD for the two simple career tables. */
function useCrud<T extends 'skills' | 'achievements'>(table: T, noun: string) {
  const qc = useQueryClient()
  const key = queryKeys[table]
  type Row = T extends 'skills' ? Skill : Achievement

  const save = useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: TablesInsert<T> }) => {
      const query = id
        ? untypedTable(table).update(values).eq('id', id)
        : untypedTable(table).insert(values)
      const { data, error } = await query.select().single()
      if (error) throw error
      return data as Row
    },
    onSuccess: (row, { id }) => {
      qc.setQueryData<Row[]>(key, (old) => (id ? old?.map((r) => (r.id === id ? row : r)) : [...(old ?? []), row]))
      qc.invalidateQueries({ queryKey: key })
      toast.success(id ? `${noun} updated` : `${noun} added`)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await untypedTable(table).delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      qc.setQueryData<Row[]>(key, (old) => old?.filter((r) => r.id !== id))
      toast.success(`${noun} deleted`)
    },
  })

  return { save, remove }
}

export const useSkillMutations = () => useCrud('skills', 'Skill')
export const useAchievementMutations = () => useCrud('achievements', 'Achievement')
