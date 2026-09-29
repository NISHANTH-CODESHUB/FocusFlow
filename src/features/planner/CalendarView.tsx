import {
  addMonths,
  addWeeks,
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
  subWeeks,
} from 'date-fns'
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, GripVertical, Inbox, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/menu'
import { Card, EmptyState } from '@/components/ui/misc'
import { toDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Item } from '@/types/database'
import { PriorityFlag } from '../items/components'
import { CATEGORY_MAP } from '../items/config'
import { useItemEditor } from '../items/editor'
import { ItemList } from '../items/ItemList'
import { compareItems, isOpen, isOverdue } from '../items/selectors'
import { dragItem, useDayDrop } from './dnd'
import { itemsOnDay } from './planning'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CHIPS = 3
const WEEK = { weekStartsOn: 1 } as const

export type CalendarMode = 'month' | 'week'

const timeOf = (it: Item) => (it.all_day ? null : format(toDate(it.due_at)!, 'h:mm a'))

export function CalendarView({ items, defaultMode = 'month' }: { items: Item[]; defaultMode?: CalendarMode }) {
  const [mode, setMode] = useState<CalendarMode>(defaultMode)
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date())
  const editor = useItemEditor()
  const { over, targetProps, reschedule } = useDayDrop(items)

  const days = useMemo(
    () =>
      mode === 'month'
        ? eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), WEEK), end: endOfWeek(endOfMonth(cursor), WEEK) })
        : eachDayOfInterval({ start: startOfWeek(cursor, WEEK), end: endOfWeek(cursor, WEEK) }),
    [mode, cursor],
  )
  const byDay = useMemo(() => new Map(days.map((d) => [d.toDateString(), itemsOnDay(items, d)])), [days, items])
  const selectedItems = byDay.get(selected.toDateString()) ?? itemsOnDay(items, selected)
  const unscheduled = useMemo(() => items.filter((i) => !i.due_at && isOpen(i)).sort(compareItems('priority')), [items])

  const step = (dir: 1 | -1) =>
    setCursor((c) => (mode === 'month' ? (dir > 0 ? addMonths(c, 1) : subMonths(c, 1)) : dir > 0 ? addWeeks(c, 1) : subWeeks(c, 1)))
  const title =
    mode === 'month'
      ? format(cursor, 'MMMM yyyy')
      : `${format(days[0]!, isSameMonth(days[0]!, days[6]!) ? 'd' : 'd MMM')} – ${format(days[6]!, 'd MMM yyyy')}`
  const addOn = (day: Date) => editor.create({ due_date: format(day, 'yyyy-MM-dd') })

  return (
    <div className="grid gap-4 2xl:grid-cols-[1fr_320px]">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" aria-label={`Previous ${mode}`} onClick={() => step(-1)}>
              <ChevronLeft />
            </Button>
            <h2 className="min-w-36 text-center text-base font-semibold">{title}</h2>
            <Button variant="ghost" size="icon-sm" aria-label={`Next ${mode}`} onClick={() => step(1)}>
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCursor(new Date())
                setSelected(new Date())
              }}
            >
              Today
            </Button>
          </div>
          <Segmented
            ariaLabel="Calendar view"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'month', label: 'Month', icon: <CalendarDays /> },
              { value: 'week', label: 'Week', icon: <CalendarRange /> },
            ]}
          />
        </div>

        {mode === 'month' ? (
          <>
            <div className="grid grid-cols-7 border-b border-border text-center text-[11px] font-medium text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2">
                  <span className="sm:hidden">{d[0]}</span>
                  <span className="hidden sm:inline">{d}</span>
                </div>
              ))}
            </div>
            <div role="grid" aria-label={title} className="grid grid-cols-7">
              {days.map((day, idx) => {
                const list = byDay.get(day.toDateString()) ?? []
                const isSelected = isSameDay(day, selected)
                return (
                  <div
                    key={day.toISOString()}
                    role="gridcell"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onClick={() => setSelected(day)}
                    onDoubleClick={() => addOn(day)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(day)}
                    {...targetProps(day)}
                    className={cn(
                      'group relative min-h-16 cursor-pointer border-border p-1 text-left outline-none transition-colors sm:min-h-28 sm:p-1.5',
                      idx % 7 !== 6 && 'border-r',
                      idx < days.length - 7 && 'border-b',
                      !isSameMonth(day, cursor) && 'bg-muted/40 text-muted-foreground',
                      isSelected ? 'bg-primary-soft/70' : 'hover:bg-accent/60',
                      over === day.toDateString() && 'bg-primary-soft ring-2 ring-primary ring-inset',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('grid size-6 place-items-center rounded-full text-xs font-medium tabular-nums', isToday(day) && 'bg-primary text-primary-foreground')}>
                        {format(day, 'd')}
                      </span>
                      <button
                        aria-label={`Add item on ${format(day, 'd MMMM')}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          addOn(day)
                        }}
                        className="hidden size-5 cursor-pointer place-items-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-card sm:grid"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    {/* Phones: dots. Larger screens: draggable chips. */}
                    <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                      {list.slice(0, 4).map((it) => (
                        <span key={it.id} className={cn('size-1.5 rounded-full', CATEGORY_MAP[it.category].dot, !isOpen(it) && 'opacity-40')} />
                      ))}
                    </div>
                    <div className="mt-1 hidden flex-col gap-0.5 sm:flex">
                      {list.slice(0, MAX_CHIPS).map((it) => (
                        <button
                          key={it.id}
                          {...(isOpen(it) ? dragItem(it) : {})}
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
                          {timeOf(it) && <span className="shrink-0 text-muted-foreground tabular-nums">{format(toDate(it.due_at)!, 'H:mm')}</span>}
                          <span className="truncate">{it.title}</span>
                        </button>
                      ))}
                      {list.length > MAX_CHIPS && <span className="px-1 text-[11px] text-muted-foreground">+{list.length - MAX_CHIPS} more</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="grid divide-y divide-border lg:grid-cols-7 lg:divide-x lg:divide-y-0">
            {days.map((day) => {
              const list = byDay.get(day.toDateString()) ?? []
              const isSelected = isSameDay(day, selected)
              return (
                <section
                  key={day.toISOString()}
                  aria-label={format(day, 'EEEE d MMMM')}
                  onClick={() => setSelected(day)}
                  {...targetProps(day)}
                  className={cn(
                    'flex min-h-28 flex-col gap-1.5 p-2 transition-colors lg:min-h-[26rem]',
                    isSelected && 'bg-primary-soft/40',
                    over === day.toDateString() && 'bg-primary-soft ring-2 ring-primary ring-inset',
                  )}
                >
                  <header className="flex items-center justify-between gap-2 px-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground uppercase">{format(day, 'EEE')}</span>
                      <span className={cn('grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums', isToday(day) && 'bg-primary text-primary-foreground')}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    <button
                      aria-label={`Add item on ${format(day, 'd MMMM')}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        addOn(day)
                      }}
                      className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                    >
                      <Plus className="size-4" />
                    </button>
                  </header>
                  {list.map((it) => (
                    <button
                      key={it.id}
                      {...(isOpen(it) ? dragItem(it) : {})}
                      onClick={(e) => {
                        e.stopPropagation()
                        editor.edit(it)
                      }}
                      className={cn(
                        'group w-full cursor-pointer rounded-lg border border-border bg-card p-2 text-left shadow-xs transition-shadow hover:shadow-md',
                        isOpen(it) && 'active:cursor-grabbing',
                        !isOpen(it) && 'opacity-60',
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className={cn('size-1.5 rounded-full', CATEGORY_MAP[it.category].dot)} />
                        {timeOf(it) && <span className={cn('tabular-nums', isOverdue(it) && 'font-medium text-destructive')}>{timeOf(it)}</span>}
                        <PriorityFlag priority={it.priority} />
                      </div>
                      <p className={cn('mt-0.5 line-clamp-3 text-xs font-medium break-words', !isOpen(it) && 'line-through')}>{it.title}</p>
                    </button>
                  ))}
                  {list.length === 0 && <p className="hidden flex-1 place-items-center rounded-lg border border-dashed border-border text-[11px] text-muted-foreground lg:grid">Free</p>}
                </section>
              )
            })}
          </div>
        )}
      </Card>

      <div className="grid content-start gap-4 md:grid-cols-2 2xl:grid-cols-1">
        <Card>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">{format(selected, 'EEEE, d MMMM')}</h3>
              <p className="text-xs text-muted-foreground">{selectedItems.length ? `${selectedItems.length} planned` : 'Nothing planned'}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => addOn(selected)}>
              <Plus /> Add
            </Button>
          </div>
          <div className="px-3 py-2">
            {selectedItems.length ? (
              <ItemList items={selectedItems} compact />
            ) : (
              <EmptyState compact title="Free day" description="Click + on a day, or drag tasks onto it." className="my-2 border-none" />
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-border px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Inbox className="size-4 text-muted-foreground" /> Unscheduled
              <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">{unscheduled.length}</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              <span className="pointer-coarse:hidden">Drag onto a day to plan it, or use the button to schedule it for the selected day.</span>
              <span className="hidden pointer-coarse:inline">Pick a day on the calendar, then tap the button to schedule it.</span>
            </p>
          </div>
          <ul className="scrollbar-thin max-h-80 space-y-1 overflow-y-auto p-2">
            {unscheduled.map((it) => (
              <li key={it.id} {...dragItem(it)} className="group flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent active:cursor-grabbing">
                <GripVertical className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                <span className={cn('size-2 shrink-0 rounded-full', CATEGORY_MAP[it.category].dot)} />
                <button onClick={() => editor.edit(it)} className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm">
                  {it.title}
                </button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => reschedule(it, selected)} aria-label={`Schedule ${it.title} on ${format(selected, 'd MMMM')}`}>
                  {isToday(selected) ? 'Today' : format(selected, 'd MMM')}
                </Button>
              </li>
            ))}
            {unscheduled.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted-foreground">Everything open has a date. Nice.</li>}
          </ul>
        </Card>
      </div>
    </div>
  )
}
