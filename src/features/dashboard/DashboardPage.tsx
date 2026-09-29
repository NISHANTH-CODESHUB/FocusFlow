import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isPast, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Flame,
  GraduationCap,
  Inbox,
  Plus,
  RotateCcw,
  Sun,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ProgressRows, Ring, SERIES, TimeBarChart } from '@/components/shared/charts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/misc'
import { formatDate, fromDateTimeInputs, greeting, toDate } from '@/lib/dates'
import { cn, pluralize } from '@/lib/utils'
import { useFiles } from '../files/api'
import type { Concept, Item } from '@/types/database'
import { useAcademics, useConceptMutations } from '../academics/api'
import { revisionsDue, subjectColor } from '../academics/tree'
import { useCreateItem, useItems, useToggleComplete } from '../items/api'
import { CategoryChip, DueLabel, PriorityFlag } from '../items/components'
import { CATEGORY_MAP } from '../items/config'
import { useItemEditor } from '../items/editor'
import { useSubjectNames } from '../items/hooks'
import { ItemActions } from '../items/ItemRow'
import { ItemList } from '../items/ItemList'
import { isOpen, upcoming } from '../items/selectors'
import { dragItem, useDayDrop, useReschedule } from '../planner/dnd'
import { itemsOnDay, todayPlan } from '../planner/planning'
import { useDisplayName } from '../settings/api'
import { aptitudeStats, certificationStats, completionSeries, dsaStats, streaks, summarize } from '../stats/compute'

export default function DashboardPage() {
  const itemsQuery = useItems()
  const academics = useAcademics()
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data])
  const now = useMemo(() => new Date(), [])
  const plan = useMemo(() => todayPlan(items, now), [items, now])

  if (itemsQuery.isLoading || academics.isLoading) return <DashboardSkeleton />
  if (itemsQuery.error) return <ErrorState error={itemsQuery.error} onRetry={() => itemsQuery.refetch()} />

  return (
    <div className="space-y-5">
      <Header plan={plan} now={now} />
      <GettingStarted items={items} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <TodayCard items={items} plan={plan} now={now} />
        <PlanningCalendar items={items} />
      </div>
      <WeekAhead items={items} now={now} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ThisWeek items={items} now={now} />
        <ProgressSnapshot items={items} />
      </div>
    </div>
  )
}

/* ---------------------------------- Header --------------------------------- */

function Header({ plan, now }: { plan: ReturnType<typeof todayPlan>; now: Date }) {
  const name = useDisplayName()
  const summary =
    plan.remaining === 0
      ? plan.doneToday.length
        ? `All done for today — ${pluralize(plan.doneToday.length, 'thing')} finished. 🎉`
        : 'Nothing on your plate today. Plan something below.'
      : `${pluralize(plan.remaining, 'thing')} left today${plan.overdue.length ? ` · ${plan.overdue.length} overdue` : ''}.`
  return (
    <div>
      <div>
        <p className="text-sm text-muted-foreground">{format(now, 'EEEE, d MMMM')}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting(now)}, {name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
      </div>
    </div>
  )
}

/* -------------------------------- Today card -------------------------------- */

function TodayCard({ items, plan, now }: { items: Item[]; plan: ReturnType<typeof todayPlan>; now: Date }) {
  const reschedule = useReschedule()
  const { data: academics } = useAcademics()
  const [showDone, setShowDone] = useState(false)
  const revisions = useMemo(() => revisionsDue(academics?.concepts ?? [], now), [academics, now])
  const nothingToday = plan.remaining === 0 && revisions.length === 0
  const nextUp = useMemo(() => upcoming(items, 7, now).filter((i) => !isSameDay(toDate(i.due_at)!, now)).slice(0, 4), [items, now])
  const undated = useMemo(() => items.filter((i) => !i.due_at && isOpen(i)).length, [items])

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center gap-4 border-b border-border px-4 py-4 sm:px-5">
        {plan.doneToday.length + plan.remaining > 0 ? (
          <Ring value={plan.percent} size={60} label="Today's progress" />
        ) : (
          <span className="grid size-[60px] shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-500">
            <Sun className="size-7" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Today</h2>
          <p className="text-sm text-muted-foreground">
            {plan.doneToday.length + plan.remaining === 0
              ? 'Nothing planned yet — add your first task below.'
              : `${plan.doneToday.length} of ${plan.doneToday.length + plan.remaining} done${plan.scheduled.length ? ` · ${plan.scheduled.length} at a set time` : ''}`}
          </p>
        </div>
      </div>

      <div className="border-b border-border px-4 py-3 sm:px-5">
        <QuickAdd now={now} />
      </div>

      <div className="flex-1 space-y-5 px-2 py-4 sm:px-3">
        {plan.overdue.length > 0 && (
          <Section
            title="Overdue"
            tone="danger"
            count={plan.overdue.length}
            action={
              <Button variant="ghost" size="sm" onClick={() => plan.overdue.forEach((it) => reschedule(it, now))}>
                Move all to today
              </Button>
            }
          >
            {plan.overdue.map((it) => (
              <TodayRow key={it.id} item={it} now={now} meta={<DueLabel item={it} />} action={<Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => reschedule(it, now)}>Today</Button>} />
            ))}
          </Section>
        )}

        {plan.scheduled.length > 0 && (
          <Section title="Schedule" count={plan.scheduled.length}>
            {plan.scheduled.map((it) => {
              const time = toDate(it.due_at)!
              return <TodayRow key={it.id} item={it} now={now} time={time} />
            })}
          </Section>
        )}

        {plan.anytime.length > 0 && (
          <Section title="Anytime today" count={plan.anytime.length}>
            {plan.anytime.map((it) => (
              <TodayRow key={it.id} item={it} now={now} />
            ))}
          </Section>
        )}

        {revisions.length > 0 && <RevisionSection concepts={revisions} />}

        {nothingToday && (
          <div className="px-2">
            <EmptyState compact icon={<Sun />} title="Your day is clear" description="Add something above, or get ahead on what's coming up." className="border-none" />
            {nextUp.length > 0 && (
              <div className="mt-1">
                <p className="mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Coming up</p>
                <ItemList items={nextUp} compact />
              </div>
            )}
          </div>
        )}

        {undated > 0 && (
          <Link to="/calendar" className="mx-2 flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground">
            <Inbox className="size-4 shrink-0" />
            <span className="flex-1">{undated === 1 ? '1 item has' : `${undated} items have`} no date yet</span>
            <span className="font-medium text-primary">Plan {undated === 1 ? 'it' : 'them'} →</span>
          </Link>
        )}

        {plan.doneToday.length > 0 && (
          <div>
            <button onClick={() => setShowDone((s) => !s)} className="flex cursor-pointer items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground" aria-expanded={showDone}>
              <ChevronDown className={cn('size-3.5 transition-transform', !showDone && '-rotate-90')} />
              Done today ({plan.doneToday.length})
            </button>
            {showDone && (
              <div className="mt-1">
                {plan.doneToday.map((it) => (
                  <TodayRow key={it.id} item={it} now={now} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function Section({ title, count, tone, action, children }: { title: string; count: number; tone?: 'danger'; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-1 flex items-center justify-between gap-2 px-2">
        <h3 className={cn('flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase', tone === 'danger' ? 'text-destructive' : 'text-muted-foreground')}>
          {tone === 'danger' && <AlertTriangle className="size-3.5" />}
          {title}
          <span className="font-normal normal-case">({count})</span>
        </h3>
        {action}
      </div>
      <div>{children}</div>
    </section>
  )
}

function TodayRow({ item, now, time, meta, action }: { item: Item; now: Date; time?: Date; meta?: ReactNode; action?: ReactNode }) {
  const editor = useItemEditor()
  const toggle = useToggleComplete()
  const subjects = useSubjectNames()
  const done = item.status === 'completed'
  const missed = !!time && !done && time < now
  return (
    <div {...(done ? {} : dragItem(item))} className={cn('group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/60', !done && 'cursor-grab active:cursor-grabbing')}>
      {time && (
        <span className={cn('w-16 shrink-0 text-right text-xs font-medium tabular-nums', missed ? 'text-destructive' : 'text-muted-foreground')} title={missed ? 'Time has passed' : undefined}>
          {format(time, 'h:mm a')}
        </span>
      )}
      <button
        onClick={() => toggle(item)}
        aria-label={done ? `Mark “${item.title}” as not done` : `Mark “${item.title}” as done`}
        className={cn(
          'grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-colors',
          done ? 'border-success bg-success text-white' : 'border-muted-foreground/40 hover:border-primary',
        )}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </button>
      <button onClick={() => editor.edit(item)} className="min-w-0 flex-1 cursor-pointer text-left">
        <span className="flex items-center gap-2">
          <span className={cn('truncate text-sm font-medium', done && 'text-muted-foreground line-through')}>{item.title}</span>
          <PriorityFlag priority={item.priority} />
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <CategoryChip category={item.category} />
          {item.subject_id && <span className="text-xs text-muted-foreground">{subjects.get(item.subject_id)}</span>}
          {meta}
          {item.progress > 0 && !done && <span className="text-xs text-muted-foreground tabular-nums">{item.progress}%</span>}
        </span>
      </button>
      {action}
      <ItemActions item={item} />
    </div>
  )
}

function RevisionSection({ concepts }: { concepts: Concept[] }) {
  const { data } = useAcademics()
  const { update } = useConceptMutations()
  const unitSubject = new Map((data?.units ?? []).map((u) => [u.id, u.subject_id]))
  const subjectCode = new Map((data?.subjects ?? []).map((s) => [s.id, s.code || s.name]))
  return (
    <Section title="Revise today" count={concepts.length}>
      {concepts.slice(0, 6).map((c) => {
        const subjectId = unitSubject.get(c.unit_id)
        return (
          <div key={c.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/60">
            <RotateCcw className="size-4 shrink-0 text-sky-500" aria-hidden />
            <Link to={`/academics/${subjectId}?concept=${c.id}`} className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{c.title}</span>
              <span className="text-xs text-muted-foreground">
                {subjectId && subjectCode.get(subjectId)} · planned {formatDate(c.revision_date, 'd MMM')}
              </span>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() =>
                update.mutate(
                  { id: c.id, patch: { revision_date: null } },
                  { onSuccess: () => toast.success(`Revised “${c.title}”`) },
                )
              }
            >
              Revised
            </Button>
          </div>
        )
      })}
    </Section>
  )
}

function QuickAdd({ now }: { now: Date }) {
  const create = useCreateItem()
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    if (t.length > 200) return toast.error('Keep the title under 200 characters')
    create.mutate(
      { title: t, category: 'task', due_at: fromDateTimeInputs(format(now, 'yyyy-MM-dd'), time || null), all_day: !time },
      {
        onSuccess: () => {
          setTitle('')
          setTime('')
          toast.success('Added to today')
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 sm:flex-nowrap">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task for today…" aria-label="Quick add a task for today" maxLength={200} className="h-10 min-w-0 basis-full sm:basis-auto sm:flex-1" />
      <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time (optional)" className="h-10 min-w-0 flex-1 sm:w-28 sm:flex-none" title="Optional time" />
      <Button type="submit" className="h-10" disabled={!title.trim()} loading={create.isPending}>
        <Plus /> Add
      </Button>
    </form>
  )
}

/* ----------------------------- Planning calendar ---------------------------- */

function PlanningCalendar({ items }: { items: Item[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => addDays(new Date(), 1))
  const editor = useItemEditor()
  const { over, targetProps } = useDayDrop(items)
  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }), [month])
  const counts = useMemo(() => new Map(days.map((d) => [d.toDateString(), itemsOnDay(items, d).filter(isOpen)])), [days, items])
  const selectedItems = itemsOnDay(items, selected)

  return (
    <Card className="h-fit">
      <CardHeader
        icon={<CalendarDays />}
        title="Plan ahead"
        description={<DragHint drag="Pick a day · drag tasks onto dates" touch="Pick a day · tap ⋯ on a task → Move to" />}
        action={
          <Link to="/calendar" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Calendar <ArrowRight className="size-3" />
          </Link>
        }
      />
      <CardBody>
        <div className="mb-2 flex items-center justify-between">
          <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonth((m) => startOfMonth(addDays(m, -1)))}>
            <ChevronLeft />
          </Button>
          <span className="text-sm font-semibold">{format(month, 'MMMM yyyy')}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth((m) => startOfMonth(addDays(endOfMonth(m), 1)))}>
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5" role="grid" aria-label={format(month, 'MMMM yyyy')}>
          {days.map((day) => {
            const open = counts.get(day.toDateString()) ?? []
            const isSel = isSameDay(day, selected)
            return (
              <button
                key={day.toISOString()}
                role="gridcell"
                aria-selected={isSel}
                aria-label={`${format(day, 'EEEE d MMMM')}, ${pluralize(open.length, 'item')}`}
                onClick={() => setSelected(day)}
                {...targetProps(day)}
                className={cn(
                  'flex aspect-square cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg text-xs tabular-nums transition-colors',
                  !isSameMonth(day, month) && 'text-muted-foreground/50',
                  isSel ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                  isToday(day) && !isSel && 'font-bold text-primary ring-1 ring-primary/40',
                  over === day.toDateString() && 'bg-primary-soft ring-2 ring-primary',
                )}
              >
                {format(day, 'd')}
                <span className="flex h-1 gap-0.5">
                  {open.slice(0, 3).map((it) => (
                    <span key={it.id} className={cn('size-1 rounded-full', isSel ? 'bg-primary-foreground' : CATEGORY_MAP[it.category].dot)} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold">{isToday(selected) ? 'Today' : format(selected, 'EEEE, d MMM')}</p>
            <Button variant="ghost" size="sm" onClick={() => editor.create({ due_date: format(selected, 'yyyy-MM-dd') })}>
              <Plus /> Add
            </Button>
          </div>
          {selectedItems.length ? (
            <ItemList items={selectedItems} compact />
          ) : (
            <p className="py-3 text-center text-xs text-muted-foreground">{isPast(selected) && !isToday(selected) ? 'Nothing was planned.' : 'Free — tap Add to plan something.'}</p>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

/* -------------------------------- Week ahead -------------------------------- */

function WeekAhead({ items, now }: { items: Item[]; now: Date }) {
  const editor = useItemEditor()
  const { over, targetProps } = useDayDrop(items)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(now, i + 1)), [now])

  return (
    <Card>
      <CardHeader
        icon={<CalendarClock />}
        title="Next 7 days"
        description={<DragHint drag="Tests, labs, deadlines and plans — drag to move" touch="Tests, labs, deadlines and plans" />}
        action={
          <Link to="/calendar" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Week view <ArrowRight className="size-3" />
          </Link>
        }
      />
      <div className="scrollbar-thin flex gap-2 overflow-x-auto px-4 pb-4 sm:px-5 lg:grid lg:grid-cols-7 lg:overflow-visible">
        {days.map((day) => {
          const list = itemsOnDay(items, day).filter(isOpen)
          const heavy = list.length >= 4
          return (
            <section
              key={day.toISOString()}
              aria-label={format(day, 'EEEE d MMMM')}
              {...targetProps(day)}
              className={cn(
                'flex min-h-36 w-40 shrink-0 flex-col rounded-xl border border-border bg-muted/30 p-2 transition-colors lg:w-auto lg:min-w-0',
                over === day.toDateString() && 'border-primary bg-primary-soft',
              )}
            >
              <header className="mb-1.5 flex items-center justify-between px-1">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase">{format(day, 'EEE')}</p>
                  <p className="text-sm font-semibold">{format(day, 'd MMM')}</p>
                </div>
                <div className="flex items-center gap-1">
                  {list.length > 0 && <span className={cn('rounded-full px-1.5 text-[11px] font-medium tabular-nums', heavy ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground')}>{list.length}</span>}
                  <button aria-label={`Add on ${format(day, 'd MMMM')}`} onClick={() => editor.create({ due_date: format(day, 'yyyy-MM-dd') })} className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground">
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </header>
              <div className="flex flex-col gap-1">
                {list.slice(0, 4).map((it) => (
                  <button key={it.id} {...dragItem(it)} onClick={() => editor.edit(it)} title={it.title} className="flex w-full cursor-pointer items-center gap-1.5 rounded-md bg-card px-1.5 py-1 text-left text-xs shadow-xs hover:shadow-md">
                    <span className={cn('size-1.5 shrink-0 rounded-full', CATEGORY_MAP[it.category].dot)} />
                    <span className="truncate">{it.title}</span>
                  </button>
                ))}
                {list.length > 4 && <span className="px-1 text-[11px] text-muted-foreground">+{list.length - 4} more</span>}
                {list.length === 0 && <span className="px-1 py-2 text-[11px] text-muted-foreground">Free</span>}
              </div>
            </section>
          )
        })}
      </div>
    </Card>
  )
}

/* ------------------------------ Week & progress ----------------------------- */

function ThisWeek({ items, now }: { items: Item[]; now: Date }) {
  const { data: academics } = useAcademics()
  const concepts = useMemo(() => academics?.concepts ?? [], [academics])
  const summary = useMemo(() => summarize(items, now), [items, now])
  const streak = useMemo(() => streaks(items, concepts, now), [items, concepts, now])
  const series = useMemo(() => completionSeries(items, concepts, '7d', now), [items, concepts, now])

  return (
    <Card>
      <CardHeader icon={<TrendingUp />} title="This week" description="What you've finished over the last 7 days" action={<Link to="/stats" className="text-xs font-medium text-primary hover:underline">Stats</Link>} />
      <CardBody>
        <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
          <MiniStat icon={<Check className="text-success" />} label="Done this week" value={summary.completedThisWeek} />
          <MiniStat icon={<Flame className="text-warning" />} label="Day streak" value={streak.current} />
          <MiniStat icon={<AlertTriangle className={summary.overdue ? 'text-destructive' : 'text-muted-foreground'} />} label="Overdue" value={summary.overdue} />
        </dl>
        <TimeBarChart
          height={150}
          ariaLabel="Completions over the last 7 days"
          data={series as unknown as Array<Record<string, string | number>>}
          series={[
            { key: 'tasks', label: 'Planner items', color: SERIES[0]! },
            { key: 'concepts', label: 'Concepts', color: SERIES[1]! },
          ]}
        />
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: SERIES[0] }} /> Planner items
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: SERIES[1] }} /> Concepts
          </span>
        </div>
      </CardBody>
    </Card>
  )
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-2.5">
      <dd className="flex items-center justify-center gap-1.5 text-xl font-semibold tabular-nums [&_svg]:size-4">
        {icon}
        {value}
      </dd>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
    </div>
  )
}

function ProgressSnapshot({ items }: { items: Item[] }) {
  const { tree } = useAcademics()
  const navigate = useNavigate()
  const dsa = dsaStats(items)
  const apt = aptitudeStats(items)
  const certs = certificationStats(items)
  const subjects = tree.filter((s) => !s.archived)

  const rows = [
    ...subjects.slice(0, 4).map((s) => ({
      key: s.id,
      label: (
        <Link to={`/academics/${s.id}`} className="inline-flex items-center gap-1.5 hover:underline">
          <GraduationCap className="size-3.5 text-muted-foreground" />
          {s.code || s.name}
        </Link>
      ),
      done: s.stats.completed,
      total: s.stats.total,
      color: subjectColor(s.color).hex,
    })),
    ...(dsa.total ? [{ key: 'dsa', label: <span className="inline-flex items-center gap-1.5"><Code2 className="size-3.5 text-muted-foreground" />DSA solved</span>, done: dsa.solved, total: dsa.total, color: SERIES[0] }] : []),
    ...(apt.total ? [{ key: 'apt', label: <span className="inline-flex items-center gap-1.5"><TrendingUp className="size-3.5 text-muted-foreground" />Aptitude topics</span>, done: apt.done, total: apt.total, color: SERIES[4] }] : []),
    ...(certs.total ? [{ key: 'certs', label: <span className="inline-flex items-center gap-1.5"><BadgeCheck className="size-3.5 text-muted-foreground" />Certifications</span>, done: certs.earned, total: certs.total, color: SERIES[3] }] : []),
  ]

  return (
    <Card>
      <CardHeader icon={<GraduationCap />} title="Progress" description="Subjects, placement prep and certifications" action={<Link to="/academics" className="text-xs font-medium text-primary hover:underline">Academics</Link>} />
      <CardBody>
        <ProgressRows
          rows={rows}
          empty={<EmptyState compact icon={<GraduationCap />} title="Nothing to track yet" action={<Button size="sm" variant="outline" onClick={() => navigate('/academics')}>Add a subject</Button>} />}
        />
      </CardBody>
    </Card>
  )
}

/* ---------------------------------- Misc ---------------------------------- */

function DragHint({ drag, touch }: { drag: string; touch: string }) {
  return (
    <>
      <span className="pointer-coarse:hidden">{drag}</span>
      <span className="hidden pointer-coarse:inline">{touch}</span>
    </>
  )
}

const ONBOARDING_KEY = 'focusflow-getting-started-hidden'

/** A checklist that stays until each first step is done (or it's dismissed). */
function GettingStarted({ items }: { items: Item[] }) {
  const editor = useItemEditor()
  const navigate = useNavigate()
  const { tree } = useAcademics()
  const { data: files } = useFiles()
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) === '1'
    } catch {
      return false
    }
  })

  const steps = [
    {
      icon: Sun,
      title: 'Plan a task for today',
      text: 'Type it in the Today box and press Enter.',
      done: items.some((i) => i.category === 'task' || i.category === 'custom'),
      run: () => document.querySelector<HTMLInputElement>('input[aria-label="Quick add a task for today"]')?.focus(),
    },
    { icon: GraduationCap, title: 'Add your subjects', text: 'Then list the topics in each unit.', done: tree.length > 0, run: () => navigate('/academics') },
    {
      icon: CalendarClock,
      title: 'Add a test or assignment',
      text: 'It shows up in your week automatically.',
      done: items.some((i) => ['test', 'assignment', 'lab'].includes(i.category)),
      run: () => editor.create({ category: 'test' }),
    },
    { icon: Upload, title: 'Upload notes or a certificate', text: 'Keep important files in one place.', done: (files?.length ?? 0) > 0, run: () => navigate('/files') },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (hidden || doneCount === steps.length) return null

  const hide = () => {
    setHidden(true)
    try {
      localStorage.setItem(ONBOARDING_KEY, '1')
    } catch {
      /* storage unavailable — hides for this visit only */
    }
  }

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary-soft to-card">
      <CardBody className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Getting started with FocusFlow</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {doneCount} of {steps.length} done — each takes about a minute.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Hide getting started" onClick={hide}>
            <X />
          </Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, text, run, done }) => (
            <button
              key={title}
              onClick={run}
              disabled={done}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 disabled:cursor-default disabled:hover:border-border',
                done && 'opacity-70',
              )}
            >
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', done ? 'bg-success text-white' : 'bg-primary-soft text-primary')}>
                {done ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
              </span>
              <span>
                <span className={cn('block text-sm font-medium', done && 'line-through')}>{title}</span>
                <span className="block text-xs text-muted-foreground">{done ? 'Done' : text}</span>
              </span>
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading dashboard">
      <Skeleton className="h-16 w-80" />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
      <Skeleton className="h-44 rounded-xl" />
    </div>
  )
}
