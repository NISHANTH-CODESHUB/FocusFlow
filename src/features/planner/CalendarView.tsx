import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import type { Item } from '@/types/database'
import { CATEGORY_MAP } from '../items/config'
import { useItemEditor } from '../items/editor'
import { ItemList } from '../items/ItemList'
import { compareItems, isOpen, isOverdue, showsOnDay } from '../items/selectors'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CHIPS = 3

export function CalendarView({ items }: { items: Item[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())
  const editor = useItemEditor()

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }),
    [month],
  )
  const dated = useMemo(() => items.filter((i) => i.due_at).sort(compareItems('due')), [items])
  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const d of days) map.set(d.toDateString(), dated.filter((i) => showsOnDay(i, d)))
    return map
  }, [days, dated])

  const selectedItems = byDay.get(selected.toDateString()) ?? dated.filter((i) => showsOnDay(i, selected))
  const undated = items.filter((i) => !i.due_at && isOpen(i)).length

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">{format(month, 'MMMM yyyy')}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMonth(startOfMonth(new Date()))
                setSelected(new Date())
              }}
            >
              Today
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonth((m) => subMonths(m, 1))}>
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-border text-center text-[11px] font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              <span className="sm:hidden">{d[0]}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
        </div>
        <div role="grid" aria-label={format(month, 'MMMM yyyy')} className="grid grid-cols-7">
          {days.map((day, idx) => {
            const list = byDay.get(day.toDateString()) ?? []
            const inMonth = isSameMonth(day, month)
            const isSelected = isSameDay(day, selected)
            return (
              <div
                key={day.toISOString()}
                role="gridcell"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => setSelected(day)}
                onDoubleClick={() => editor.create({ due_date: format(day, 'yyyy-MM-dd') })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setSelected(day)
                }}
                className={cn(
                  'group relative min-h-16 cursor-pointer border-border p-1 text-left outline-none transition-colors sm:min-h-28 sm:p-1.5',
                  idx % 7 !== 6 && 'border-r',
                  idx < days.length - 7 && 'border-b',
                  !inMonth && 'bg-muted/40 text-muted-foreground',
                  isSelected ? 'bg-primary-soft/70' : 'hover:bg-accent/60',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'grid size-6 place-items-center rounded-full text-xs font-medium tabular-nums',
                      isToday(day) && 'bg-primary text-primary-foreground',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  <button
                    aria-label={`Add item on ${format(day, 'd MMMM')}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      editor.create({ due_date: format(day, 'yyyy-MM-dd') })
                    }}
                    className="hidden size-5 cursor-pointer place-items-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-card sm:grid"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                {/* Phones: dots. Larger screens: chips. */}
                <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                  {list.slice(0, 4).map((it) => (
                    <span key={it.id} className={cn('size-1.5 rounded-full', CATEGORY_MAP[it.category].dot, !isOpen(it) && 'opacity-40')} />
                  ))}
                </div>
                <div className="mt-1 hidden flex-col gap-0.5 sm:flex">
                  {list.slice(0, MAX_CHIPS).map((it) => (
                    <button
                      key={it.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        editor.edit(it)
                      }}
                      title={it.title}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-card',
                        !isOpen(it) && 'text-muted-foreground line-through',
                        isOverdue(it) && 'text-destructive',
                      )}
                    >
                      <span className={cn('size-1.5 shrink-0 rounded-full', CATEGORY_MAP[it.category].dot)} />
                      <span className="truncate">{it.title}</span>
                    </button>
                  ))}
                  {list.length > MAX_CHIPS && <span className="px-1 text-[11px] text-muted-foreground">+{list.length - MAX_CHIPS} more</span>}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="h-fit">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">{format(selected, 'EEEE, d MMMM')}</h3>
            <p className="text-xs text-muted-foreground">{selectedItems.length ? `${selectedItems.length} scheduled` : 'Nothing scheduled'}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => editor.create({ due_date: format(selected, 'yyyy-MM-dd') })}>
            <Plus /> Add
          </Button>
        </div>
        <div className="px-3 py-2">
          {selectedItems.length ? (
            <ItemList items={selectedItems} />
          ) : (
            <EmptyState compact title="Free day" description="Double-click any day on the calendar to add an item." className="my-2 border-none" />
          )}
        </div>
        {undated > 0 && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{undated} open items have no date and aren't shown on the calendar.</p>}
      </Card>
    </div>
  )
}
