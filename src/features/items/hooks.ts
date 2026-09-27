import { useMemo } from 'react'
import { useAcademics } from '../academics/api'
import { useFiles } from '../files/api'

/** id → display name for subjects, used to annotate planner rows. */
export function useSubjectNames(): Map<string, string> {
  const { data } = useAcademics()
  return useMemo(() => new Map((data?.subjects ?? []).map((s) => [s.id, s.code || s.name])), [data?.subjects])
}

/** item id → number of attached files. */
export function useAttachmentCounts(): Map<string, number> {
  const { data } = useFiles()
  return useMemo(() => {
    const map = new Map<string, number>()
    for (const f of data ?? []) if (f.item_id) map.set(f.item_id, (map.get(f.item_id) ?? 0) + 1)
    return map
  }, [data])
}
