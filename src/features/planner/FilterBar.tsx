import { Check, Filter, Search, X } from 'lucide-react'
import { DropdownMenu as M } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ItemCategory, ItemPriority, ItemStatus, Subject } from '@/types/database'
import { CATEGORIES, PRIORITIES, STATUSES } from '../items/config'
import type { ItemFilters, SortKey } from '../items/selectors'

interface FilterBarProps {
  filters: ItemFilters
  onChange: (next: ItemFilters) => void
  sort: SortKey
  onSortChange: (sort: SortKey) => void
  subjects: Subject[]
  showSort?: boolean
}

function MultiSelect<V extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: ReadonlyArray<{ value: V; label: string }>
  selected: V[]
  onChange: (values: V[]) => void
}) {
  const toggle = (v: V) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
  return (
    <M.Root>
      <M.Trigger asChild>
        <Button variant="outline" size="md" className={cn('font-normal', selected.length && 'border-primary/40 text-primary')}>
          <Filter className="size-3.5" />
          {label}
          {selected.length > 0 && <span className="rounded bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{selected.length}</span>}
        </Button>
      </M.Trigger>
      <M.Portal>
        <M.Content align="start" sideOffset={6} className="z-50 max-h-80 min-w-48 overflow-y-auto rounded-xl border border-border bg-card p-1 text-sm shadow-lg">
          {options.map((o) => (
            <M.CheckboxItem
              key={o.value}
              checked={selected.includes(o.value)}
              onSelect={(e) => {
                e.preventDefault()
                toggle(o.value)
              }}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 outline-none data-[highlighted]:bg-accent"
            >
              <span className={cn('grid size-4 place-items-center rounded border', selected.includes(o.value) ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                {selected.includes(o.value) && <Check className="size-3" />}
              </span>
              {o.label}
            </M.CheckboxItem>
          ))}
          {selected.length > 0 && (
            <>
              <M.Separator className="-mx-1 my-1 h-px bg-border" />
              <M.Item onSelect={() => onChange([])} className="cursor-pointer rounded-md px-2.5 py-1.5 text-muted-foreground outline-none data-[highlighted]:bg-accent">
                Clear
              </M.Item>
            </>
          )}
        </M.Content>
      </M.Portal>
    </M.Root>
  )
}

export function FilterBar({ filters, onChange, sort, onSortChange, subjects, showSort = true }: FilterBarProps) {
  const set = (patch: Partial<ItemFilters>) => onChange({ ...filters, ...patch })
  const active = !!(filters.search || filters.categories?.length || filters.statuses?.length || filters.priorities?.length || filters.subjectId)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search ?? ''}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search title, notes, tags…"
          aria-label="Search planner"
          className="pl-8"
        />
      </div>
      <MultiSelect<ItemCategory> label="Category" options={CATEGORIES.map((c) => ({ value: c.value, label: c.plural }))} selected={filters.categories ?? []} onChange={(categories) => set({ categories })} />
      <MultiSelect<ItemStatus> label="Status" options={STATUSES} selected={filters.statuses ?? []} onChange={(statuses) => set({ statuses })} />
      <MultiSelect<ItemPriority> label="Priority" options={PRIORITIES} selected={filters.priorities ?? []} onChange={(priorities) => set({ priorities })} />
      {subjects.length > 0 && (
        <Select aria-label="Subject" value={filters.subjectId ?? ''} onChange={(e) => set({ subjectId: e.target.value || undefined })} className="w-40">
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code || s.name}
            </option>
          ))}
        </Select>
      )}
      {showSort && (
        <Select aria-label="Sort by" value={sort} onChange={(e) => onSortChange(e.target.value as SortKey)} className="w-36">
          <option value="due">Sort: Due date</option>
          <option value="priority">Sort: Priority</option>
          <option value="created">Sort: Newest</option>
          <option value="title">Sort: Title</option>
        </Select>
      )}
      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ showCompleted: filters.showCompleted })}>
          <X /> Clear filters
        </Button>
      )}
    </div>
  )
}
