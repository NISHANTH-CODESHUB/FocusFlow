import { format } from 'date-fns'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Code2,
  Flame,
  GraduationCap,
  Plus,
  RotateCcw,
  Rocket,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProgressRows, Ring, SegmentBar, SERIES, TimeBarChart } from '@/components/shared/charts'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/menu'
import { Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton, Stat } from '@/components/ui/misc'
import { formatDate, greeting } from '@/lib/dates'
import { useAcademics } from '../academics/api'
import { revisionsDue, subjectColor } from '../academics/tree'
import { useSkills } from '../career/api'
import { useItems } from '../items/api'
import { CategoryIcon, DueLabel, PriorityFlag } from '../items/components'
import { CATEGORY_MAP } from '../items/config'
import { useItemEditor } from '../items/editor'
import { ItemList } from '../items/ItemList'
import { compareItems, isDueOn, isOverdue, upcoming } from '../items/selectors'
import { useDisplayName } from '../settings/api'
import { aptitudeStats, certificationStats, completionSeries, dsaStats, streaks, summarize } from '../stats/compute'

export default function DashboardPage() {
  const name = useDisplayName()
  const editor = useItemEditor()
  const navigate = useNavigate()
  const itemsQuery = useItems()
  const academics = useAcademics()
  const { data: skills } = useSkills()
  const [range, setRange] = useState<'7d' | '30d'>('7d')

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data])
  const concepts = useMemo(() => academics.data?.concepts ?? [], [academics.data])
  const now = useMemo(() => new Date(), [])

  const view = useMemo(() => {
    const today = items.filter((it) => (isDueOn(it, now) || isOverdue(it, now)) && it.status !== 'cancelled' && (it.status !== 'completed' || isDueOn(it, now)))
    return {
      summary: summarize(items, now),
      streak: streaks(items, concepts, now),
      today: today.sort((a, b) => Number(b.status !== 'completed') - Number(a.status !== 'completed') || compareItems('due')(a, b)),
      exams: upcoming(items, 21, now, ['test', 'lab', 'assignment']),
      deadlines: upcoming(items, 7, now).filter((it) => !isDueOn(it, now)),
      career: upcoming(items, 60, now, ['project', 'hackathon', 'event', 'internship']),
      dsa: dsaStats(items),
      aptitude: aptitudeStats(items),
      certs: certificationStats(items, now),
      revisions: revisionsDue(concepts, now).filter((c) => c.status !== 'not_started'),
    }
  }, [items, concepts, now])

  const series = useMemo(() => completionSeries(items, concepts, range, now), [items, concepts, range, now])

  if (itemsQuery.isLoading || academics.isLoading) return <DashboardSkeleton />
  if (itemsQuery.error) return <ErrorState error={itemsQuery.error} onRetry={() => itemsQuery.refetch()} />

  const firstRun = items.length === 0 && academics.tree.length === 0
  const { summary, streak } = view
  const certGoals = items.filter((it) => it.category === 'certification' && it.status !== 'completed' && it.status !== 'cancelled')
  const learning = (skills ?? []).filter((s) => s.progress < 100).sort((a, b) => b.progress - a.progress)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{format(now, 'EEEE, d MMMM')}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting(now)}, {name.split(' ')[0]}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => editor.create({ category: 'test' })}>
            <Plus /> Test
          </Button>
          <Button variant="outline" size="sm" onClick={() => editor.create({ category: 'assignment' })}>
            <Plus /> Assignment
          </Button>
          <Button variant="outline" size="sm" onClick={() => editor.create({ category: 'dsa' })}>
            <Plus /> DSA problem
          </Button>
        </div>
      </div>

      {firstRun && <Onboarding />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Due today" value={summary.dueToday} hint={`${summary.dueThisWeek} due in the next 7 days`} icon={<CalendarClock />} onClick={() => navigate('/planner')} />
        <Stat
          label="Overdue"
          value={summary.overdue}
          hint={summary.overdue ? 'Needs attention' : 'All caught up'}
          icon={<AlertTriangle />}
          tone={summary.overdue ? 'danger' : 'success'}
          onClick={() => navigate('/planner')}
        />
        <Stat label="Done this week" value={summary.completedThisWeek} hint={`${summary.completionRate}% of all work completed`} icon={<CheckCircle2 />} tone="success" />
        <Stat label="Streak" value={`${streak.current}d`} hint={`Best: ${streak.best} days`} icon={<Flame />} tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<CalendarCheck2 />}
            title="Today"
            description={view.today.length ? `${view.today.filter((t) => t.status !== 'completed').length} open · overdue items included` : 'Nothing due today'}
            action={
              <Button variant="ghost" size="sm" onClick={() => editor.create({ due_date: format(now, 'yyyy-MM-dd') })}>
                <Plus /> Add
              </Button>
            }
          />
          <CardBody>
            {view.today.length ? (
              <ItemList items={view.today} limit={8} />
            ) : (
              <EmptyState compact icon={<CheckCircle2 />} title="A clear day" description="Nothing due today. Plan ahead or knock out something from later this week." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<BookOpen />} title="Tests, labs & assignments" description="Next 3 weeks" />
          <CardBody>
            {view.exams.length ? (
              <ul className="space-y-1">
                {view.exams.slice(0, 6).map((it) => (
                  <li key={it.id}>
                    <button onClick={() => editor.edit(it)} className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left hover:bg-accent">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${CATEGORY_MAP[it.category].chip}`}>
                        <CategoryIcon category={it.category} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{it.title}</span>
                        <DueLabel item={it} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<BookOpen />} title="No tests or labs coming up" action={<Button size="sm" variant="outline" onClick={() => editor.create({ category: 'test' })}>Add a test</Button>} />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<TrendingUp />}
            title="Productivity"
            description="Items completed and concepts mastered"
            action={<Segmented ariaLabel="Chart range" value={range} onChange={setRange} options={[{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }]} />}
          />
          <CardBody>
            <TimeBarChart
              ariaLabel={`Completions over the last ${range === '7d' ? 7 : 30} days`}
              data={series as unknown as Array<Record<string, string | number>>}
              series={[
                { key: 'tasks', label: 'Planner items', color: SERIES[0]! },
                { key: 'concepts', label: 'Concepts', color: SERIES[1]! },
              ]}
            />
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: SERIES[0] }} /> Planner items{' '}
                <span className="font-medium text-foreground tabular-nums">{series.reduce((s, p) => s + p.tasks, 0)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: SERIES[1] }} /> Concepts{' '}
                <span className="font-medium text-foreground tabular-nums">{series.reduce((s, p) => s + p.concepts, 0)}</span>
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<CalendarClock />} title="Deadlines this week" description="Sorted by due date" action={<ViewAll to="/planner" />} />
          <CardBody>
            {view.deadlines.length ? (
              <ul className="space-y-1">
                {view.deadlines.slice(0, 7).map((it) => (
                  <li key={it.id}>
                    <button onClick={() => editor.edit(it)} className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-accent">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${CATEGORY_MAP[it.category].dot}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm">{it.title}</span>
                          <PriorityFlag priority={it.priority} />
                        </span>
                        <DueLabel item={it} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<CalendarClock />} title="No deadlines this week" />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader icon={<Rocket />} title="Projects, events & internships" description="Next 60 days" action={<ViewAll to="/career" />} />
          <CardBody>
            {view.career.length ? (
              <ul className="space-y-1">
                {view.career.slice(0, 6).map((it) => (
                  <li key={it.id}>
                    <button onClick={() => editor.edit(it)} className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left hover:bg-accent">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${CATEGORY_MAP[it.category].chip}`}>
                        <CategoryIcon category={it.category} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{it.title}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{CATEGORY_MAP[it.category].label}</span>
                          <DueLabel item={it} />
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<Rocket />} title="Nothing scheduled" description="Add a hackathon, internship application or project milestone." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Code2 />} title="Placement prep" description="DSA & aptitude" action={<ViewAll to="/career?tab=dsa" />} />
          <CardBody className="space-y-5">
            <div className="flex items-center gap-4">
              <Ring value={view.dsa.percent} label="DSA solved" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  DSA · {view.dsa.solved}/{view.dsa.total} solved
                </p>
                <SegmentBar
                  className="mt-2"
                  segments={view.dsa.byDifficulty
                    .filter((b) => b.key !== '_none')
                    .map((b, i) => ({ key: b.key, label: b.label, value: b.done, color: [SERIES[2]!, SERIES[3]!, SERIES[7]!][i] ?? SERIES[0]! }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Ring value={view.aptitude.percent} label="Aptitude topics done" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  Aptitude · {view.aptitude.done}/{view.aptitude.total} topics
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {view.aptitude.averageScore !== null ? `Mock average ${view.aptitude.averageScore}% across ${view.aptitude.mocks} tests` : 'Log a mock score to see your average'}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<BadgeCheck />} title="Certifications & learning" description={`${view.certs.earned} earned · ${view.certs.inProgress} in progress`} action={<ViewAll to="/career?tab=certifications" />} />
          <CardBody>
            <ProgressRows
              rows={[
                ...certGoals.slice(0, 3).map((c) => ({ key: c.id, label: c.title, done: c.progress, total: 100, color: SERIES[3], suffix: `${c.progress}%` })),
                ...learning.slice(0, 3).map((s) => ({ key: s.id, label: `${s.name}`, done: s.progress, total: 100, color: SERIES[6], suffix: `${s.progress}%` })),
              ]}
              empty={<EmptyState compact icon={<Target />} title="No learning goals yet" description="Track a certification or a skill you're learning." />}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={<GraduationCap />} title="Academic progress" description="Concept mastery by subject" action={<ViewAll to="/academics" />} />
          <CardBody>
            <ProgressRows
              rows={academics.tree
                .filter((s) => !s.archived)
                .map((s) => ({
                  key: s.id,
                  label: (
                    <Link to={`/academics/${s.id}`} className="hover:underline">
                      {s.code ? `${s.code} · ` : ''}
                      {s.name}
                    </Link>
                  ),
                  done: s.stats.completed,
                  total: s.stats.total,
                  color: subjectColor(s.color).hex,
                  suffix: s.stats.total ? undefined : 'No concepts yet',
                }))}
              empty={<EmptyState compact icon={<GraduationCap />} title="No subjects yet" action={<Button size="sm" variant="outline" onClick={() => navigate('/academics')}>Add subjects</Button>} />}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<RotateCcw />} title="Revision due" description="Concepts scheduled for review" />
          <CardBody>
            {view.revisions.length ? (
              <ul className="space-y-1">
                {view.revisions.slice(0, 6).map((c) => {
                  const unit = academics.data?.units.find((u) => u.id === c.unit_id)
                  return (
                    <li key={c.id}>
                      <Link to={`/academics/${unit?.subject_id}?concept=${c.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent">
                        <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(c.revision_date, 'd MMM')}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState compact icon={<RotateCcw />} title="No revisions due" description="Set revision dates on concepts to get reminders here." />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function ViewAll({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
      View all <ArrowRight className="size-3" />
    </Link>
  )
}

function Onboarding() {
  const editor = useItemEditor()
  const navigate = useNavigate()
  const steps = [
    { icon: GraduationCap, title: 'Add your subjects', text: 'Break them into units and concepts.', run: () => navigate('/academics') },
    { icon: CalendarClock, title: 'Plan an upcoming test', text: 'Tests, labs and assignments show up here.', run: () => editor.create({ category: 'test' }) },
    { icon: Code2, title: 'Log a DSA problem', text: 'Track topics, difficulty and platforms.', run: () => editor.create({ category: 'dsa' }) },
    { icon: BadgeCheck, title: 'Track a certification', text: 'Attach the certificate once you earn it.', run: () => editor.create({ category: 'certification' }) },
  ]
  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary-soft to-card">
      <CardBody className="pt-5">
        <h2 className="font-semibold">Welcome to FocusFlow 👋</h2>
        <p className="mt-1 text-sm text-muted-foreground">Start with any of these — everything connects to your dashboard automatically. Press N anytime to add something.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, text, run }) => (
            <button key={title} onClick={run} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                <Icon className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-muted-foreground">{text}</span>
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
    <div className="space-y-6" aria-busy aria-label="Loading dashboard">
      <Skeleton className="h-12 w-72" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}
