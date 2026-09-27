import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { fetchAll, queryKeys } from '@/lib/query'
import { supabase, untypedTable } from '@/lib/supabase'
import type { Concept, Subject, TablesInsert, TablesUpdate, Unit } from '@/types/database'
import { buildAcademicTree } from './tree'

export interface AcademicData {
  subjects: Subject[]
  units: Unit[]
  concepts: Concept[]
}

async function fetchAcademics(): Promise<AcademicData> {
  const [subjects, units, concepts] = await Promise.all([
    fetchAll<Subject>((f, t) => supabase.from('subjects').select('*').order('position').order('created_at').order('id').range(f, t)),
    fetchAll<Unit>((f, t) => supabase.from('units').select('*').order('position').order('created_at').order('id').range(f, t)),
    fetchAll<Concept>((f, t) => supabase.from('concepts').select('*').order('position').order('created_at').order('id').range(f, t)),
  ])
  return { subjects, units, concepts }
}

export function useAcademics() {
  const query = useQuery({ queryKey: queryKeys.academics, queryFn: fetchAcademics })
  const tree = useMemo(() => (query.data ? buildAcademicTree(query.data) : []), [query.data])
  return { ...query, tree }
}

type Table = 'subjects' | 'units' | 'concepts'
type Entity<T extends Table> = T extends 'subjects' ? Subject : T extends 'units' ? Unit : Concept

const listKey = { subjects: 'subjects', units: 'units', concepts: 'concepts' } as const

/** Create / update / delete for one level of the hierarchy, patching the shared cache. */
function useEntityMutations<T extends Table>(table: T, noun: string, { quietCreate = false } = {}) {
  const qc = useQueryClient()
  const patchCache = (fn: (list: Entity<T>[]) => Entity<T>[]) =>
    qc.setQueryData<AcademicData>(queryKeys.academics, (old) =>
      old ? { ...old, [listKey[table]]: fn(old[listKey[table]] as Entity<T>[]) } : old,
    )

  const create = useMutation({
    mutationFn: async (payload: TablesInsert<T>) => {
      const { data, error } = await untypedTable(table).insert(payload).select().single()
      if (error) throw error
      return data as Entity<T>
    },
    onSuccess: (row) => {
      patchCache((list) => [...list, row])
      if (!quietCreate) toast.success(`${noun} added`)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<T> }) => {
      const { data, error } = await untypedTable(table).update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as Entity<T>
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: queryKeys.academics })
      const previous = qc.getQueryData<AcademicData>(queryKeys.academics)
      patchCache((list) =>
        list.map((row) => {
          if (row.id !== id) return row
          const next = { ...row, ...patch } as Entity<T>
          if (table === 'concepts' && 'status' in patch) {
            const c = next as Concept
            c.completed_at = c.status === 'completed' ? (c.completed_at ?? new Date().toISOString()) : null
          }
          return next
        }),
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(queryKeys.academics, ctx.previous),
    onSuccess: (row) => patchCache((list) => list.map((r) => (r.id === row.id ? row : r))),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await untypedTable(table).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(`${noun} deleted`)
      // Children cascade in the database; refetch to drop them and unlink files/items.
      qc.invalidateQueries({ queryKey: queryKeys.academics })
      qc.invalidateQueries({ queryKey: queryKeys.files })
      if (table === 'subjects') qc.invalidateQueries({ queryKey: queryKeys.items })
    },
  })

  return { create, update, remove }
}

export const useSubjectMutations = () => useEntityMutations('subjects', 'Subject')
export const useUnitMutations = () => useEntityMutations('units', 'Unit')
// Concepts are added inline (often in bulk), where the new row itself is the feedback.
export const useConceptMutations = () => useEntityMutations('concepts', 'Concept', { quietCreate: true })

/** Next position at the end of a sibling list. */
export function nextPosition(rows: ReadonlyArray<{ position: number }>): number {
  return rows.reduce((max, r) => Math.max(max, r.position), -1) + 1
}
