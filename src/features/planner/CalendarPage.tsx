import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { ErrorState, Skeleton } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import type { ItemCategory } from '@/types/database'
import { useItems } from '../items/api'
import { CATEGORIES } from '../items/config'
import { useItemEditor } from '../items/editor'
import { CalendarView } from './CalendarView'

export default function CalendarPage() {
  const { data, isLoading, error, refetch } = useItems()
  const editor = useItemEditor()
  const [hidden, setHidden] = useState<ItemCategory[]>([])
  const items = useMemo(() => (data ?? []).filter((i) => !hidden.includes(i.category)), [data, hidden])
  const used = useMemo(() => CATEGORIES.filter((c) => (data ?? []).some((i) => i.category === c.value)), [data])

  const toggle = (c: ItemCategory) => setHidden((h) => (h.includes(c) ? h.filter((x) => x !== c) : [...h, c]))

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Plan your week: add work to any day, drag items to reschedule, and schedule anything without a date."
        actions={
          <Button onClick={() => editor.create()}>
            <Plus /> New item
          </Button>
        }
      />
      {used.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Show categories">
          {used.map((c) => {
            const on = !hidden.includes(c.value)
            return (
              <button
                key={c.value}
                aria-pressed={on}
                onClick={() => toggle(c.value)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  on ? 'border-border bg-card text-foreground' : 'border-dashed border-border text-muted-foreground line-through',
                )}
              >
                <span className={cn('size-2 rounded-full', c.dot, !on && 'opacity-40')} />
                {c.plural}
              </button>
            )
          })}
        </div>
      )}
      {isLoading ? <Skeleton className="h-[32rem] rounded-xl" /> : error ? <ErrorState error={error} onRetry={() => refetch()} /> : <CalendarView items={items} defaultMode="week" />}
    </div>
  )
}
