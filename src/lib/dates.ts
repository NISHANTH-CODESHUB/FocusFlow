import {
  differenceInCalendarDays,
  endOfDay,
  format,
  formatDistanceToNowStrict,
  isThisYear,
  isToday,
  isTomorrow,
  isValid,
  isYesterday,
  parseISO,
  startOfDay,
} from 'date-fns'

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = typeof value === 'string' ? (value.length === 10 ? parseLocalDate(value) : parseISO(value)) : value
  return d && isValid(d) ? d : null
}

/** Parses a date-only column (yyyy-MM-dd) as a local date, not UTC midnight. */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  return isValid(date) ? startOfDay(date) : null
}

/** "Today", "Tomorrow", "Mon, 4 Oct", "4 Oct 2027" */
export function formatDay(value: string | Date | null | undefined, now = new Date()): string {
  const d = toDate(value)
  if (!d) return ''
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isYesterday(d)) return 'Yesterday'
  const days = Math.abs(differenceInCalendarDays(d, now))
  if (days < 7) return format(d, 'EEE, d MMM')
  return format(d, isThisYear(d) ? 'd MMM' : 'd MMM yyyy')
}

export function formatDue(value: string | null, allDay: boolean): string {
  const d = toDate(value)
  if (!d) return 'No date'
  return allDay ? formatDay(d) : `${formatDay(d)}, ${format(d, 'h:mm a')}`
}

export function formatDate(value: string | Date | null | undefined, pattern = 'd MMM yyyy'): string {
  const d = toDate(value)
  return d ? format(d, pattern) : ''
}

export function relative(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : ''
}

/** The instant an item actually becomes late (end of day for all-day items). */
export function deadlineOf(dueAt: string | null, allDay: boolean): Date | null {
  const d = toDate(dueAt)
  if (!d) return null
  return allDay ? endOfDay(d) : d
}

export function daysUntil(value: string | Date | null | undefined, now = new Date()): number | null {
  const d = toDate(value)
  return d ? differenceInCalendarDays(d, now) : null
}

/** yyyy-MM-dd in local time (for <input type="date"> and date columns). */
export function toDateInput(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? format(d, 'yyyy-MM-dd') : ''
}

export function toTimeInput(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? format(d, 'HH:mm') : ''
}

/** Combines local date + optional time inputs into an ISO timestamp. */
export function fromDateTimeInputs(date: string, time?: string | null): string | null {
  const local = parseLocalDate(date)
  if (!local) return null
  if (time) {
    const [hh, mm] = time.split(':').map(Number)
    local.setHours(hh ?? 0, mm ?? 0, 0, 0)
  }
  return local.toISOString()
}

export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
