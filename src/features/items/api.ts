import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchAll, queryKeys } from '@/lib/query'
import { supabase } from '@/lib/supabase'
import type { Item, ItemStatus, TablesInsert, TablesUpdate } from '@/types/database'

async function fetchItems(): Promise<Item[]> {
  return fetchAll<Item>((from, to) =>
    supabase.from('items').select('*').order('created_at', { ascending: true }).order('id').range(from, to),
  )
}

/**
 * All of the user's planner items. One cache entry feeds the planner, calendar,
 * dashboard, career tracker and statistics, so they never disagree.
 */
export function useItems() {
  return useQuery({ queryKey: queryKeys.items, queryFn: fetchItems })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: TablesInsert<'items'>) => {
      const { data, error } = await supabase.from('items').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (item) => {
      qc.setQueryData<Item[]>(queryKeys.items, (old) => (old ? [...old, item] : [item]))
    },
  })
}

/** Optimistic update: the UI changes instantly and rolls back on failure. */
export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<'items'> }) => {
      const { data, error } = await supabase.from('items').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: queryKeys.items })
      const previous = qc.getQueryData<Item[]>(queryKeys.items)
      qc.setQueryData<Item[]>(queryKeys.items, (old) =>
        old?.map((it) => {
          if (it.id !== id) return it
          const next = { ...it, ...patch } as Item
          if (patch.status === 'completed') {
            next.progress = 100
            next.completed_at ??= new Date().toISOString()
          } else if (patch.status) next.completed_at = null
          return next
        }),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.items, ctx.previous)
    },
    onSuccess: (item) => {
      qc.setQueryData<Item[]>(queryKeys.items, (old) => old?.map((it) => (it.id === item.id ? item : it)))
    },
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('items').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.items })
      const previous = qc.getQueryData<Item[]>(queryKeys.items)
      qc.setQueryData<Item[]>(queryKeys.items, (old) => old?.filter((it) => it.id !== id))
      return { previous }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.items, ctx.previous)
    },
    onSuccess: () => {
      toast.success('Deleted')
      // Attached files were unlinked by the database (on delete set null).
      qc.invalidateQueries({ queryKey: queryKeys.files })
    },
  })
}

/**
 * Patch for moving an item to a new status. Completing forces progress to 100
 * (DB trigger); reopening a finished item resets it so it doesn't look done.
 */
export function statusPatch(item: Pick<Item, 'status' | 'progress'>, status: ItemStatus): TablesUpdate<'items'> {
  if (item.status === 'completed' && status !== 'completed' && item.progress === 100) return { status, progress: 0 }
  return { status }
}

/** Toggle an item between completed and to-do, with an undo action. */
export function useToggleComplete() {
  const update = useUpdateItem()
  return (item: Item) => {
    const completing = item.status !== 'completed'
    const previousStatus = item.status
    // The promise (unlike per-call mutate callbacks) settles even if the user toggles again quickly.
    update
      .mutateAsync({ id: item.id, patch: statusPatch(item, completing ? 'completed' : 'todo') })
      .then(() => {
        if (!completing) return
        toast.success(`Completed “${item.title}”`, {
          duration: 8000,
          action: {
            label: 'Undo',
            onClick: () => update.mutate({ id: item.id, patch: { status: previousStatus, progress: item.progress } }),
          },
        })
      })
      .catch(() => undefined) // surfaced by the global mutation error toast
  }
}
