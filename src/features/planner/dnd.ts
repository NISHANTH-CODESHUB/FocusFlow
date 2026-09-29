import { useCallback, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { formatDay } from '@/lib/dates'
import type { Item } from '@/types/database'
import { useUpdateItem } from '../items/api'
import { rescheduleTo } from './planning'

export const ITEM_DRAG_TYPE = 'text/item-id'

/** Props that make an element draggable as a planner item. */
export function dragItem(item: Pick<Item, 'id'>) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(ITEM_DRAG_TYPE, item.id)
      e.dataTransfer.effectAllowed = 'move'
    },
  }
}

/** Moves an item to a day, with an Undo toast. */
export function useReschedule() {
  const update = useUpdateItem()
  return useCallback(
    (item: Item, day: Date) => {
      const patch = rescheduleTo(item, day)
      if (!Object.keys(patch).length) return
      const previous = { due_at: item.due_at, start_at: item.start_at, all_day: item.all_day }
      update
        .mutateAsync({ id: item.id, patch })
        .then(() =>
          toast.success(`Moved “${item.title}” to ${formatDay(day)}`, {
            duration: 8000,
            action: { label: 'Undo', onClick: () => update.mutate({ id: item.id, patch: previous }) },
          }),
        )
        .catch(() => undefined) // surfaced by the global mutation error toast
    },
    [update],
  )
}

/** Turns calendar cells into drop targets that reschedule the dropped item. */
export function useDayDrop(items: readonly Item[]) {
  const reschedule = useReschedule()
  const [over, setOver] = useState<string | null>(null)

  const targetProps = (day: Date) => {
    const key = day.toDateString()
    return {
      onDragOver: (e: DragEvent) => {
        if (!e.dataTransfer.types.includes(ITEM_DRAG_TYPE)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (over !== key) setOver(key)
      },
      onDragLeave: (e: DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === key ? null : o))
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault()
        setOver(null)
        const item = items.find((i) => i.id === e.dataTransfer.getData(ITEM_DRAG_TYPE))
        if (item) reschedule(item, day)
      },
    }
  }

  return { over, targetProps, reschedule }
}
