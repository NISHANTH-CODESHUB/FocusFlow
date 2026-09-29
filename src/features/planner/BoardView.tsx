import { Plus } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import type { Item, ItemStatus } from '@/types/database'
import { statusPatch, useUpdateItem } from '../items/api'
import { ITEM_DRAG_TYPE } from './dnd'
import { CategoryChip, DueLabel, PriorityFlag } from '../items/components'
import { STATUS_MAP } from '../items/config'
import { useItemEditor } from '../items/editor'
import { useSubjectNames } from '../items/hooks'
import { ItemActions } from '../items/ItemRow'
import { compareItems } from '../items/selectors'

const COLUMNS: ItemStatus[] = ['todo', 'in_progress', 'on_hold', 'completed']
const DOT: Record<ItemStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-sky-500',
  on_hold: 'bg-amber-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
}

/** Kanban by status. Drag cards between columns (desktop) or use the card menu (touch). */
export function BoardView({ items }: { items: Item[] }) {
  const update = useUpdateItem()
  const editor = useItemEditor()
  const subjects = useSubjectNames()
  const [over, setOver] = useState<ItemStatus | null>(null)
  const columns = items.some((i) => i.status === 'cancelled') ? [...COLUMNS, 'cancelled' as const] : COLUMNS

  const onDrop = (e: DragEvent, status: ItemStatus) => {
    e.preventDefault()
    setOver(null)
    const id = e.dataTransfer.getData(ITEM_DRAG_TYPE)
    const item = items.find((i) => i.id === id)
    if (item && item.status !== status) update.mutate({ id, patch: statusPatch(item, status) })
  }

  return (
    <div className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {columns.map((status) => {
        const list = items.filter((i) => i.status === status).sort(compareItems('due'))
        return (
          <section
            key={status}
            aria-label={STATUS_MAP[status].label}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(status)
            }}
            onDragLeave={() => setOver((s) => (s === status ? null : s))}
            onDrop={(e) => onDrop(e, status)}
            className={cn(
              'flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/50 transition-colors',
              over === status && 'border-primary bg-primary-soft',
            )}
          >
            <header className="flex items-center gap-2 px-3 py-2.5">
              <span className={cn('size-2 rounded-full', DOT[status])} />
              <h2 className="text-sm font-semibold">{STATUS_MAP[status].label}</h2>
              <span className="text-xs text-muted-foreground tabular-nums">{list.length}</span>
              {status !== 'completed' && status !== 'cancelled' && (
                <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Add to ${STATUS_MAP[status].label}`} onClick={() => editor.create({ status })}>
                  <Plus />
                </Button>
              )}
            </header>
            <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
              {list.map((it) => (
                <article
                  key={it.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(ITEM_DRAG_TYPE, it.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  className="group cursor-grab rounded-lg border border-border bg-card p-3 shadow-xs transition-shadow hover:shadow-md active:cursor-grabbing"
                >
                  <div className="flex items-start gap-2">
                    <button onClick={() => editor.edit(it)} className={cn('min-w-0 flex-1 cursor-pointer text-left text-sm font-medium', status === 'completed' && 'text-muted-foreground line-through')}>
                      {it.title}
                    </button>
                    <ItemActions item={it} className="-mt-1 -mr-1" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <CategoryChip category={it.category} />
                    <PriorityFlag priority={it.priority} />
                    {it.subject_id && <span className="text-xs text-muted-foreground">{subjects.get(it.subject_id)}</span>}
                  </div>
                  {(it.due_at || (it.progress > 0 && status !== 'completed')) && (
                    <div className="mt-2 flex items-center gap-3">
                      <DueLabel item={it} />
                      {it.progress > 0 && status !== 'completed' && <Progress value={it.progress} size="xs" className="ml-auto w-16" label="Progress" />}
                    </div>
                  )}
                </article>
              ))}
              {list.length === 0 && <p className="grid flex-1 place-items-center rounded-lg border border-dashed border-border py-6 text-xs text-muted-foreground">Drop items here</p>}
            </div>
          </section>
        )
      })}
    </div>
  )
}
