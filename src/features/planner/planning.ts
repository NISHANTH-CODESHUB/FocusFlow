import { addDays, differenceInCalendarDays, isSameDay, startOfDay } from 'date-fns'
import { toDate } from '@/lib/dates'
import type { Item, TablesUpdate } from '@/types/database'
import { compareItems, isDueOn, isOpen, isOverdue, showsOnDay } from '../items/selectors'

/**
 * Patch that moves an item to another day. Timed items keep their time of day,
 * multi-day items keep their length, undated items become all-day on that day.
 */
export function rescheduleTo(item: Pick<Item, 'due_at' | 'start_at' | 'all_day'>, day: Date): TablesUpdate<'items'> {
  const due = toDate(item.due_at)
  if (!due) return { due_at: startOfDay(day).toISOString(), all_day: true }
  const delta = differenceInCalendarDays(day, due)
  if (delta === 0) return {}
  const start = toDate(item.start_at)
  return {
    due_at: addDays(due, delta).toISOString(),
    ...(start ? { start_at: addDays(start, delta).toISOString() } : {}),
  }
}

export interface TodayPlan {
  /** Open items from previous days. */
  overdue: Item[]
  /** Due today at a specific time, earliest first (including times already passed). */
  scheduled: Item[]
  /** Due today with no time, plus multi-day items running today. */
  anytime: Item[]
  doneToday: Item[]
  remaining: number
  percent: number
}

export function todayPlan(items: readonly Item[], now = new Date()): TodayPlan {
  const overdue: Item[] = []
  const scheduled: Item[] = []
  const anytime: Item[] = []
  const doneToday: Item[] = []
  for (const it of items) {
    if (it.status === 'completed') {
      const at = toDate(it.completed_at)
      if (at && isSameDay(at, now)) doneToday.push(it)
      continue
    }
    if (!isOpen(it)) continue
    if (isDueOn(it, now) && !it.all_day) scheduled.push(it)
    else if (isOverdue(it, now)) overdue.push(it)
    else if (showsOnDay(it, now)) anytime.push(it)
  }
  const sort = compareItems('due')
  const remaining = overdue.length + scheduled.length + anytime.length
  const total = remaining + doneToday.length
  return {
    overdue: overdue.sort(sort),
    scheduled: scheduled.sort(sort),
    anytime: anytime.sort(compareItems('priority')),
    doneToday: doneToday.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    remaining,
    percent: total ? Math.round((doneToday.length / total) * 100) : 0,
  }
}

/** Open (or done) items that appear on a given calendar day, ordered for display. */
export function itemsOnDay(items: readonly Item[], day: Date): Item[] {
  return items
    .filter((it) => it.status !== 'cancelled' && showsOnDay(it, day))
    .sort((a, b) => Number(!isOpen(a)) - Number(!isOpen(b)) || Number(a.all_day) - Number(b.all_day) || compareItems('due')(a, b))
}
