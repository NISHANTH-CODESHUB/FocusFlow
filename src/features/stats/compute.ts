import {
  addDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns'
import { deadlineOf, parseLocalDate, toDate } from '@/lib/dates'
import { percent } from '@/lib/utils'
import type { Concept, Item, ItemCategory } from '@/types/database'
import { APTITUDE_SECTIONS, CATEGORIES, CATEGORY_MAP, DSA_DIFFICULTY, INTERNSHIP_STAGES } from '../items/config'
import { detail, detailNumber } from '../items/schema'
import { isOpen, isOverdue } from '../items/selectors'

export interface Summary {
  total: number
  open: number
  completed: number
  inProgress: number
  overdue: number
  dueToday: number
  dueThisWeek: number
  completedThisWeek: number
  completionRate: number
}

export function summarize(items: readonly Item[], now = new Date()): Summary {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfDay(addDays(now, 7))
  let open = 0
  let completed = 0
  let inProgress = 0
  let overdue = 0
  let dueToday = 0
  let dueThisWeek = 0
  let completedThisWeek = 0
  let closed = 0
  for (const it of items) {
    if (it.status === 'cancelled') {
      closed++
      continue
    }
    if (it.status === 'completed') {
      completed++
      const at = toDate(it.completed_at)
      if (at && at >= weekStart) completedThisWeek++
      continue
    }
    open++
    if (it.status === 'in_progress') inProgress++
    if (isOverdue(it, now)) overdue++
    const due = toDate(it.due_at)
    if (due && isSameDay(due, now)) dueToday++
    const deadline = deadlineOf(it.due_at, it.all_day)
    if (deadline && deadline >= now && due! <= weekEnd) dueThisWeek++
  }
  return {
    total: items.length,
    open,
    completed,
    inProgress,
    overdue,
    dueToday,
    dueThisWeek,
    completedThisWeek,
    completionRate: percent(completed, items.length - closed),
  }
}

export interface SeriesPoint {
  key: string
  label: string
  tasks: number
  concepts: number
  /** Planner items created in the period (for created-vs-completed trends). */
  created: number
}

export type Range = '7d' | '30d' | '90d' | '12m'

export const RANGES: ReadonlyArray<{ value: Range; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '12m', label: '12 months' },
]

/** Completions per day (or per month for 12m) across items and concepts. */
export function completionSeries(items: readonly Item[], concepts: readonly Concept[], range: Range, now = new Date()): SeriesPoint[] {
  const monthly = range === '12m'
  const bucketKey = (d: Date) => format(d, monthly ? 'yyyy-MM' : 'yyyy-MM-dd')
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const periods = monthly
    ? eachMonthOfInterval({ start: startOfMonth(subMonths(now, 11)), end: now })
    : eachDayOfInterval({ start: startOfDay(subDays(now, days - 1)), end: now })

  const points = new Map<string, SeriesPoint>(
    periods.map((d) => [
      bucketKey(d),
      {
        key: bucketKey(d),
        label: format(d, monthly ? 'MMM' : range === '7d' ? 'EEE' : 'd MMM'),
        tasks: 0,
        concepts: 0,
        created: 0,
      },
    ]),
  )
  for (const it of items) {
    const at = it.status === 'completed' ? toDate(it.completed_at) : null
    const p = at && points.get(bucketKey(at))
    if (p) p.tasks++
    const created = toDate(it.created_at)
    const c = created && points.get(bucketKey(created))
    if (c) c.created++
  }
  for (const c of concepts) {
    const at = c.status === 'completed' ? toDate(c.completed_at) : null
    const p = at && points.get(bucketKey(at))
    if (p) p.concepts++
  }
  return [...points.values()]
}

export interface CategoryStat {
  category: ItemCategory
  label: string
  total: number
  completed: number
  open: number
  percent: number
}

export function categoryBreakdown(items: readonly Item[]): CategoryStat[] {
  return CATEGORIES.map((c) => {
    const list = items.filter((it) => it.category === c.value && it.status !== 'cancelled')
    const completed = list.filter((it) => it.status === 'completed').length
    return { category: c.value, label: c.plural, total: list.length, completed, open: list.length - completed, percent: percent(completed, list.length) }
  }).filter((s) => s.total > 0)
}

/** Current and best streak of days with at least one completion. */
export function streaks(items: readonly Item[], concepts: readonly Concept[], now = new Date()): { current: number; best: number } {
  const days = new Set<string>()
  for (const it of items) if (it.status === 'completed' && it.completed_at) days.add(format(toDate(it.completed_at)!, 'yyyy-MM-dd'))
  for (const c of concepts) if (c.status === 'completed' && c.completed_at) days.add(format(toDate(c.completed_at)!, 'yyyy-MM-dd'))
  if (!days.size) return { current: 0, best: 0 }

  const sorted = [...days].sort()
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseLocalDate(sorted[i - 1])!
    const cur = parseLocalDate(sorted[i])!
    run = isSameDay(addDays(prev, 1), cur) ? run + 1 : 1
    best = Math.max(best, run)
  }

  // A streak is still alive if the last completion was today or yesterday.
  let current = 0
  let cursor = startOfDay(now)
  if (!days.has(format(cursor, 'yyyy-MM-dd'))) cursor = subDays(cursor, 1)
  while (days.has(format(cursor, 'yyyy-MM-dd'))) {
    current++
    cursor = subDays(cursor, 1)
  }
  return { current, best }
}

/* ------------------------------ Career stats ------------------------------ */

const ofCategory = (items: readonly Item[], category: ItemCategory) =>
  items.filter((it) => it.category === category && it.status !== 'cancelled')

export interface Bucket {
  key: string
  label: string
  total: number
  done: number
}

function tally(list: readonly Item[], keyOf: (it: Item) => string | undefined, labels: ReadonlyArray<{ value: string; label: string }>, fallback = 'Unspecified'): Bucket[] {
  const map = new Map<string, Bucket>(labels.map((l) => [l.value, { key: l.value, label: l.label, total: 0, done: 0 }]))
  for (const it of list) {
    const key = keyOf(it) ?? '_none'
    if (!map.has(key)) map.set(key, { key, label: key === '_none' ? fallback : key, total: 0, done: 0 })
    const b = map.get(key)!
    b.total++
    if (it.status === 'completed') b.done++
  }
  return [...map.values()]
}

export function dsaStats(items: readonly Item[]) {
  const list = ofCategory(items, 'dsa')
  const solved = list.filter((it) => it.status === 'completed').length
  const byDifficulty = tally(list, (it) => detail(it, 'difficulty'), DSA_DIFFICULTY)
  const byTopic = tally(list, (it) => detail(it, 'topic'), []).sort((a, b) => b.total - a.total)
  const platforms = CATEGORY_MAP.dsa.fields.find((f) => f.key === 'platform')?.options ?? []
  const byPlatform = tally(list, (it) => detail(it, 'platform'), platforms).filter((b) => b.total > 0)
  return { total: list.length, solved, percent: percent(solved, list.length), byDifficulty, byTopic, byPlatform }
}

export function aptitudeStats(items: readonly Item[]) {
  const list = ofCategory(items, 'aptitude')
  const sections = tally(list, (it) => detail(it, 'section'), APTITUDE_SECTIONS)
  const scored = list
    .map((it) => {
      const score = detailNumber(it, 'score')
      const total = detailNumber(it, 'total')
      return score !== undefined && total ? (score / total) * 100 : undefined
    })
    .filter((v): v is number => v !== undefined)
  const done = list.filter((it) => it.status === 'completed').length
  return {
    total: list.length,
    done,
    percent: percent(done, list.length),
    sections,
    mocks: scored.length,
    averageScore: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
  }
}

export function projectStats(items: readonly Item[]) {
  const list = ofCategory(items, 'project')
  const done = list.filter((it) => it.status === 'completed').length
  const avg = list.length ? Math.round(list.reduce((s, it) => s + it.progress, 0) / list.length) : 0
  return { total: list.length, done, active: list.filter((it) => it.status === 'in_progress').length, averageProgress: avg }
}

export function certificationStats(items: readonly Item[], now = new Date()) {
  const list = ofCategory(items, 'certification')
  const earned = list.filter((it) => it.status === 'completed')
  const soon = addDays(now, 60)
  const expiringSoon = earned.filter((it) => {
    const exp = parseLocalDate(detail(it, 'expires_on'))
    return exp && exp >= startOfDay(now) && exp <= soon
  })
  return {
    total: list.length,
    earned: earned.length,
    inProgress: list.filter((it) => isOpen(it)).length,
    percent: percent(earned.length, list.length),
    averageProgress: list.length ? Math.round(list.reduce((s, it) => s + it.progress, 0) / list.length) : 0,
    expiringSoon: expiringSoon.length,
  }
}

export function internshipPipeline(items: readonly Item[]) {
  const list = items.filter((it) => it.category === 'internship')
  return INTERNSHIP_STAGES.map((s) => ({
    stage: s.value,
    label: s.label,
    count: list.filter((it) => (detail(it, 'stage') ?? 'wishlist') === s.value).length,
  }))
}
