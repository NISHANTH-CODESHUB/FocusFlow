import { AlertTriangle, CalendarClock, Flag } from 'lucide-react'
import { Badge } from '@/components/ui/misc'
import { daysUntil, formatDue } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Item, ItemCategory, ItemPriority, ItemStatus } from '@/types/database'
import { CATEGORY_MAP, PRIORITY_MAP, STATUS_MAP } from './config'
import { isOverdue } from './selectors'

export function CategoryIcon({ category, className }: { category: ItemCategory; className?: string }) {
  const Icon = CATEGORY_MAP[category].icon
  return <Icon className={cn('size-4', className)} aria-hidden />
}

export function CategoryChip({ category, className }: { category: ItemCategory; className?: string }) {
  const c = CATEGORY_MAP[category]
  const Icon = c.icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4', c.chip, className)}>
      <Icon className="size-3" aria-hidden />
      {c.label}
    </span>
  )
}

export function StatusBadge({ status }: { status: ItemStatus }) {
  const s = STATUS_MAP[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function PriorityFlag({ priority, showLabel }: { priority: ItemPriority; showLabel?: boolean }) {
  const p = PRIORITY_MAP[priority]
  if (priority === 'low' && !showLabel) return null
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', p.className)} title={`${p.label} priority`}>
      <Flag className="size-3" fill={priority === 'urgent' ? 'currentColor' : 'none'} aria-hidden />
      {showLabel ? p.label : <span className="sr-only">{p.label} priority</span>}
    </span>
  )
}

/** Due date with urgency coloring: red when overdue, amber within 2 days. */
export function DueLabel({ item, className }: { item: Pick<Item, 'due_at' | 'all_day' | 'status'>; className?: string }) {
  if (!item.due_at) return null
  const overdue = isOverdue(item)
  const days = daysUntil(item.due_at)
  const soon = !overdue && days !== null && days <= 2 && item.status !== 'completed' && item.status !== 'cancelled'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground',
        soon && 'text-amber-600 dark:text-amber-400',
        overdue && 'font-medium text-red-600 dark:text-red-400',
        className,
      )}
    >
      {overdue ? <AlertTriangle className="size-3" aria-hidden /> : <CalendarClock className="size-3" aria-hidden />}
      {overdue && <span className="sr-only">Overdue:</span>}
      {formatDue(item.due_at, item.all_day)}
    </span>
  )
}
