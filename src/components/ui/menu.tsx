import { DropdownMenu as M, Tabs as T } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* ------------------------------ Dropdown menu ------------------------------ */

export const Menu = M.Root
export const MenuTrigger = M.Trigger

export function MenuContent({ children, align = 'end', className }: { children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-44 overflow-hidden rounded-xl border border-border bg-card p-1 text-sm shadow-lg data-[state=open]:animate-in',
          className,
        )}
      >
        {children}
      </M.Content>
    </M.Portal>
  )
}

interface MenuItemProps {
  children: ReactNode
  icon?: ReactNode
  onSelect?: () => void
  destructive?: boolean
  disabled?: boolean
}

export function MenuItem({ children, icon, onSelect, destructive, disabled }: MenuItemProps) {
  return (
    <M.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground',
        destructive && 'text-destructive [&_svg]:text-destructive data-[highlighted]:bg-destructive/10',
      )}
    >
      {icon}
      {children}
    </M.Item>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{children}</M.Label>
}

export function MenuSeparator() {
  return <M.Separator className="-mx-1 my-1 h-px bg-border" />
}

/* ---------------------------------- Tabs ---------------------------------- */

export const Tabs = T.Root
export const TabsContent = T.Content

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <T.List
      className={cn(
        'scrollbar-none -mx-1 flex max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-border px-1',
        className,
      )}
    >
      {children}
    </T.List>
  )
}

export function TabsTrigger({ value, children, count }: { value: string; children: ReactNode; count?: number }) {
  return (
    <T.Trigger
      value={value}
      className="relative -mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground [&_svg]:size-4"
    >
      {children}
      {count !== undefined && <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{count}</span>}
    </T.Trigger>
  )
}

/* ---------------------------- Segmented control ---------------------------- */

interface SegmentedProps<V extends string> {
  value: V
  onChange: (value: V) => void
  options: Array<{ value: V; label: ReactNode; icon?: ReactNode }>
  className?: string
  ariaLabel: string
}

export function Segmented<V extends string>({ value, onChange, options, className, ariaLabel }: SegmentedProps<V>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex rounded-lg bg-muted p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          aria-label={typeof o.label === 'string' ? o.label : undefined}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors [&_svg]:size-3.5',
            value === o.value ? 'bg-card text-foreground shadow-xs' : 'hover:text-foreground',
          )}
        >
          {o.icon}
          <span className={cn(o.icon && 'hidden sm:inline')}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}
