import { CalendarDays, ChevronDown, Columns3, List, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/menu'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/misc'
import { cn, pluralize } from '@/lib/utils'
import type { ItemCategory } from '@/types/database'
import { useAcademics } from '../academics/api'
import { useItems } from '../items/api'
import { CATEGORY_MAP } from '../items/config'
import { useItemEditor } from '../items/editor'
import { ItemList } from '../items/ItemList'
import { BUCKET_LABELS, bucketize, compareItems, filterItems, type ItemFilters, type SortKey } from '../items/selectors'
import { BoardView } from './BoardView'
import { CalendarView } from './CalendarView'
import { FilterBar } from './FilterBar'

type View = 'list' | 'board' | 'calendar'

export default function PlannerPage() {
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) || 'list'
  const initialCategory = params.get('category') as ItemCategory | null
  const [filters, setFilters] = useState<ItemFilters>(() => ({
    categories: initialCategory && CATEGORY_MAP[initialCategory] ? [initialCategory] : [],
    showCompleted: true,
  }))
  const [sort, setSort] = useState<SortKey>('due')
  const { data: items, isLoading, error, refetch } = useItems()
  const { data: academics } = useAcademics()
  const editor = useItemEditor()

  const filtered = useMemo(() => filterItems(items ?? [], filters).sort(compareItems(sort)), [items, filters, sort])

  const setView = (v: View) =>
    setParams(
      (p) => {
        p.set('view', v)
        return p
      },
      { replace: true },
    )

  const newDefaults = filters.categories?.length === 1 ? { category: filters.categories[0] } : undefined

  return (
    <div>
      <PageHeader
        title="Planner"
        description="Everything with a date: tasks, tests, labs, assignments, projects, events and more."
        actions={
          <>
            <Segmented
              ariaLabel="Planner view"
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: 'List', icon: <List /> },
                { value: 'board', label: 'Board', icon: <Columns3 /> },
                { value: 'calendar', label: 'Calendar', icon: <CalendarDays /> },
              ]}
            />
            <Button onClick={() => editor.create(newDefaults)}>
              <Plus /> New item
            </Button>
          </>
        }
      />

      <div className="mb-5">
        <FilterBar filters={filters} onChange={setFilters} sort={sort} onSortChange={setSort} subjects={academics?.subjects ?? []} showSort={view === 'list'} />
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !items?.length ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Your planner is empty"
          description="Add a task, test, lab, assignment or anything else with a deadline. Press N from anywhere."
          action={
            <Button onClick={() => editor.create()}>
              <Plus /> Add your first item
            </Button>
          }
        />
      ) : view === 'calendar' ? (
        <CalendarView items={filtered} />
      ) : view === 'board' ? (
        <BoardView items={filtered} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<List />} title="No items match these filters" description="Try clearing a filter or searching for something else." />
      ) : (
        <ListView items={filtered} sort={sort} />
      )}
    </div>
  )
}

function ListView({ items, sort }: { items: ReturnType<typeof filterItems>; sort: SortKey }) {
  const [showDone, setShowDone] = useState(false)
  // Agenda grouping only makes sense when sorted by date.
  if (sort !== 'due') {
    return (
      <div className="rounded-xl border border-border bg-card px-3 py-1">
        <ItemList items={items} />
      </div>
    )
  }
  const buckets = bucketize(items)
  return (
    <div className="space-y-5">
      {buckets.map(({ key, items: list }) => {
        const collapsed = key === 'done' && !showDone
        return (
          <section key={key} aria-labelledby={`bucket-${key}`}>
            <button
              id={`bucket-${key}`}
              onClick={() => key === 'done' && setShowDone((s) => !s)}
              className={cn('mb-1.5 flex items-center gap-2 text-sm font-semibold', key === 'overdue' && 'text-destructive', key === 'done' && 'cursor-pointer text-muted-foreground')}
            >
              {key === 'done' && <ChevronDown className={cn('size-4 transition-transform', collapsed && '-rotate-90')} />}
              {BUCKET_LABELS[key]}
              <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">{list.length}</span>
            </button>
            {!collapsed && (
              <div className="rounded-xl border border-border bg-card px-3 py-1">
                <ItemList items={list} />
              </div>
            )}
          </section>
        )
      })}
      <p className="text-center text-xs text-muted-foreground">{pluralize(items.length, 'item')}</p>
    </div>
  )
}
