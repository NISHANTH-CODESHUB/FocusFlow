import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* ---------------------------------- Card ---------------------------------- */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // min-w-0 lets cards shrink inside grid/flex tracks (charts otherwise pin their width).
  return <div className={cn('min-w-0 rounded-xl border border-border bg-card text-card-foreground shadow-xs', className)} {...props} />
}

interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function CardHeader({ title, description, icon, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary [&_svg]:size-4">{icon}</span>}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pb-4 sm:px-5', className)} {...props} />
}

/* ---------------------------------- Badge --------------------------------- */

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground ring-border',
        primary: 'bg-primary-soft text-primary ring-primary/20',
        success: 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-400',
        warning: 'bg-amber-500/10 text-amber-700 ring-amber-600/20 dark:text-amber-400',
        danger: 'bg-red-500/10 text-red-700 ring-red-600/20 dark:text-red-400',
        info: 'bg-sky-500/10 text-sky-700 ring-sky-600/20 dark:text-sky-400',
        violet: 'bg-violet-500/10 text-violet-700 ring-violet-600/20 dark:text-violet-400',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

/* -------------------------------- Progress -------------------------------- */

interface ProgressProps {
  value: number
  className?: string
  barClassName?: string
  size?: 'xs' | 'sm' | 'md'
  label?: string
}

export function Progress({ value, className, barClassName, size = 'sm', label }: ProgressProps) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)))
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('w-full overflow-hidden rounded-full bg-muted', { xs: 'h-1', sm: 'h-1.5', md: 'h-2.5' }[size], className)}
    >
      <div
        className={cn('h-full rounded-full bg-primary transition-[width] duration-500', v === 100 && 'bg-success', barClassName)}
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

/* ------------------------------ Loading states ----------------------------- */

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <Loader2 className="size-4 animate-spin" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  )
}

/* ------------------------------- Empty state ------------------------------- */

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}

export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border text-center',
        compact ? 'gap-1.5 px-4 py-6' : 'gap-2 px-6 py-12',
        className,
      )}
    >
      {icon && (
        <div className={cn('grid place-items-center rounded-full bg-muted text-muted-foreground', compact ? 'size-9 [&_svg]:size-4' : 'mb-1 size-12 [&_svg]:size-5')}>
          {icon}
        </div>
      )}
      <p className={cn('font-medium', compact ? 'text-sm' : 'text-base')}>{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : 'Unknown error'
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
      <p className="font-medium text-destructive">Couldn't load this data</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 text-sm font-medium text-primary hover:underline cursor-pointer">
          Try again
        </button>
      )}
    </div>
  )
}

/* ------------------------------- Stat tile -------------------------------- */

interface StatProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: 'default' | 'danger' | 'success' | 'warning'
  onClick?: () => void
}

export function Stat({ label, value, hint, icon, tone = 'default', onClick }: StatProps) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex w-full min-w-0 flex-col gap-1 rounded-xl border border-border bg-card p-4 text-left shadow-xs',
        onClick && 'cursor-pointer transition-colors hover:border-primary/40',
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        <span className="leading-tight">{label}</span>
        {icon && (
          <span
            className={cn(
              '[&_svg]:size-4',
              tone === 'danger' && 'text-destructive',
              tone === 'success' && 'text-success',
              tone === 'warning' && 'text-warning',
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
    </Comp>
  )
}
