import { addDays, differenceInCalendarDays, endOfDay, endOfWeek, isSameDay, startOfDay } from 'date-fns'
import { deadlineOf, toDate } from '@/lib/dates'
import type { Item, ItemCategory, ItemPriority, ItemStatus } from '@/types/database'
import { OPEN_STATUSES, PRIORITY_MAP } from './config'

export const isOpen = (item: Pick<Item, 'status'>) => OPEN_STATUSES.includes(item.status)

export function isOverdue(item: Pick<Item, 'status' | 'due_at' | 'all_day'>, now = new Date()): boolean {
  if (!isOpen(item)) return false
  const deadline = deadlineOf(item.due_at, item.all_day)
  return !!deadline && deadline < now
}

export function isDueOn(item: Pick<Item, 'due_at'>, day: Date): boolean {
  const d = toDate(item.due_at)
  return !!d && isSameDay(d, day)
}

/** True when the item's [start, due] span covers the given day. */
export function spansDay(item: Pick<Item, 'start_at' | 'due_at'>, day: Date): boolean {
  const due = toDate(item.due_at)
  const start = toDate(item.start_at) ?? due
  if (!start || !due) return false
  return startOfDay(start) <= endOfDay(day) && endOfDay(due) >= startOfDay(day)
}

const MAX_SPAN_DAYS = 7

/**
 * Whether an item appears on a calendar day. Short multi-day items (events,
 * hackathons) fill their whole span; long-running ones (projects, certification
 * prep) appear only on their start and due days so they don't flood the month.
 */
export function showsOnDay(item: Pick<Item, 'start_at' | 'due_at'>, day: Date): boolean {
  const due = toDate(item.due_at)
  if (!due) return false
  if (isSameDay(due, day)) return true
  const start = toDate(item.start_at)
  if (!start) return false
  if (isSameDay(start, day)) return true
  return differenceInCalendarDays(due, start) <= MAX_SPAN_DAYS && spansDay(item, day)
}

export type SortKey = 'due' | 'priority' | 'created' | 'title'

export function compareItems(sort: SortKey) {
  return (a: Item, b: Item): number => {
    switch (sort) {
      case 'priority':
        return PRIORITY_MAP[b.priority].rank - PRIORITY_MAP[a.priority].rank || byDue(a, b)
      case 'created':
        return b.created_at.localeCompare(a.created_at)
      case 'title':
        return a.title.localeCompare(b.title)
      default:
        return byDue(a, b) || PRIORITY_MAP[b.priority].rank - PRIORITY_MAP[a.priority].rank
    }
  }
}

/** Earliest due first; undated items last. */
function byDue(a: Item, b: Item): number {
  if (a.due_at === b.due_at) return 0
  if (!a.due_at) return 1
  if (!b.due_at) return -1
  return a.due_at.localeCompare(b.due_at)
}

export interface ItemFilters {
  search?: string
  categories?: ItemCategory[]
  statuses?: ItemStatus[]
  priorities?: ItemPriority[]
  subjectId?: string
  showCompleted?: boolean
}

export function filterItems(items: readonly Item[], f: ItemFilters): Item[] {
  const q = f.search?.trim().toLowerCase()
  return items.filter((it) => {
    if (f.categories?.length && !f.categories.includes(it.category)) return false
    if (f.statuses?.length && !f.statuses.includes(it.status)) return false
    if (f.priorities?.length && !f.priorities.includes(it.priority)) return false
    if (f.subjectId && it.subject_id !== f.subjectId) return false
    if (f.showCompleted === false && !isOpen(it) && !f.statuses?.length) return false
    if (q) {
      const haystack = [it.title, it.description, it.notes, it.tags.join(' '), JSON.stringify(it.details)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

export type BucketKey = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'someday' | 'done'

export const BUCKET_LABELS: Record<BucketKey, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This week',
  later: 'Later',
  someday: 'No date',
  done: 'Completed & closed',
}

/** Groups items into agenda buckets for the list view. */
export function bucketize(items: readonly Item[], now = new Date()): Array<{ key: BucketKey; items: Item[] }> {
  const buckets: Record<BucketKey, Item[]> = { overdue: [], today: [], tomorrow: [], week: [], later: [], someday: [], done: [] }
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  for (const it of items) {
    if (!isOpen(it)) buckets.done.push(it)
    else if (!it.due_at) buckets.someday.push(it)
    else if (isOverdue(it, now)) buckets.overdue.push(it)
    else {
      const due = toDate(it.due_at)!
      if (isSameDay(due, today)) buckets.today.push(it)
      else if (isSameDay(due, tomorrow)) buckets.tomorrow.push(it)
      else if (due <= weekEnd) buckets.week.push(it)
      else buckets.later.push(it)
    }
  }
  return (Object.keys(buckets) as BucketKey[]).map((key) => ({ key, items: buckets[key] })).filter((b) => b.items.length)
}

export function upcoming(items: readonly Item[], days: number, now = new Date(), categories?: ItemCategory[]): Item[] {
  const horizon = endOfDay(addDays(now, days))
  return items
    .filter((it) => isOpen(it) && it.due_at && (!categories || categories.includes(it.category)))
    .filter((it) => {
      const deadline = deadlineOf(it.due_at, it.all_day)!
      return deadline >= now && toDate(it.due_at)! <= horizon
    })
    .sort(compareItems('due'))
}
