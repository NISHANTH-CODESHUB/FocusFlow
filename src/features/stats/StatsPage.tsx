import { Activity, AlertTriangle, BadgeCheck, CalendarClock, CheckCircle2, Code2, Flame, FolderKanban, GraduationCap, Layers, Lightbulb, ListChecks, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import { Legend, ProgressRows, SegmentBar, SERIES, TimeBarChart, TimeLineChart } from '@/components/shared/charts'
import { Segmented } from '@/components/ui/menu'
import { Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton, Stat } from '@/components/ui/misc'
import { useAcademics } from '../academics/api'
import { progressOf, subjectColor } from '../academics/tree'
import { useItems } from '../items/api'
import { DueLabel, PriorityFlag } from '../items/components'
import { CATEGORY_MAP, STATUSES } from '../items/config'
import { useItemEditor } from '../items/editor'
import { upcoming } from '../items/selectors'
import { aptitudeStats, categoryBreakdown, certificationStats, completionSeries, dsaStats, projectStats, RANGES, streaks, summarize, type Range } from './compute'

const STATUS_COLOR: Record<string, string> = {
  todo: 'var(--chart-muted)',
  in_progress: SERIES[0]!,
  on_hold: SERIES[3]!,
  completed: SERIES[2]!,
  cancelled: SERIES[7]!,
}

export default function StatsPage() {
  const [range, setRange] = useState<Range>('30d')
  const itemsQuery = useItems()
  const academics = useAcademics()
  const editor = useItemEditor()
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data])
  const concepts = useMemo(() => academics.data?.concepts ?? [], [academics.data])

  const s = useMemo(() => {
    const series = completionSeries(items, concepts, range)
    return {
      summary: summarize(items),
      streak: streaks(items, concepts),
      series,
      completedInRange: series.reduce((a, p) => a + p.tasks, 0),
      conceptsInRange: series.reduce((a, p) => a + p.concepts, 0),
      categories: categoryBreakdown(items),
      dsa: dsaStats(items),
      apt: aptitudeStats(items),
      projects: projectStats(items),
      certs: certificationStats(items),
      academic: progressOf(concepts),
      deadlines: upcoming(items, 14),
      statuses: STATUSES.map((st) => ({ key: st.value, label: st.label, value: items.filter((i) => i.status === st.value).length, color: STATUS_COLOR[st.value]! })),
    }
  }, [items, concepts, range])

  if (itemsQuery.isLoading || academics.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }
  if (itemsQuery.error) return <ErrorState error={itemsQuery.error} onRetry={() => itemsQuery.refetch()} />

  const rangeLabel = RANGES.find((r) => r.value === range)!.label
  const hasData = items.length > 0 || concepts.length > 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Progress & statistics"
        description="How your work, study and prep are trending."
        actions={<Segmented ariaLabel="Time range" value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />}
      />

      {!hasData && <EmptyState icon={<Activity />} title="No data yet" description="Statistics fill in as you add and complete planner items and study concepts." />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label={`Completed · ${rangeLabel}`} value={s.completedInRange} hint="Planner items" icon={<CheckCircle2 />} tone="success" />
        <Stat label={`Concepts · ${rangeLabel}`} value={s.conceptsInRange} hint="Marked completed" icon={<Lightbulb />} />
        <Stat label="Finished overall" value={`${s.summary.completionRate}%`} hint={`${s.summary.completed} of ${s.summary.total - s.statuses.find((x) => x.key === 'cancelled')!.value} items`} icon={<ListChecks />} />
        <Stat label="Still to do" value={s.summary.open} hint={`${s.summary.inProgress} in progress`} icon={<Layers />} />
        <Stat label="Overdue" value={s.summary.overdue} icon={<AlertTriangle />} tone={s.summary.overdue ? 'danger' : 'success'} hint={s.summary.overdue ? 'Reschedule or finish' : 'Nothing overdue'} />
        <Stat label="Streak" value={`${s.streak.current}d`} hint={`Best ${s.streak.best} days`} icon={<Flame />} tone="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader icon={<TrendingUp />} title="What you finished" description={`Items and topics completed each ${range === '12m' ? 'month' : 'day'} · ${rangeLabel}`} action={<Legend series={[{ key: 't', label: 'Planner items', color: SERIES[0]! }, { key: 'c', label: 'Concepts', color: SERIES[1]! }]} />} />
          <CardBody>
            <TimeBarChart
              ariaLabel="Completed planner items and concepts over time"
              data={s.series as unknown as Array<Record<string, string | number>>}
              series={[
                { key: 'tasks', label: 'Planner items', color: SERIES[0]! },
                { key: 'concepts', label: 'Concepts', color: SERIES[1]! },
              ]}
              height={240}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Activity />} title="Added vs finished" description="New items you added and items you finished — if the purple line stays above, your list is growing" action={<Legend series={[{ key: 'a', label: 'Added', color: SERIES[6]! }, { key: 'b', label: 'Completed', color: SERIES[2]! }]} />} />
          <CardBody>
            <TimeLineChart
              ariaLabel="Planner items added versus completed over time"
              data={s.series as unknown as Array<Record<string, string | number>>}
              series={[
                { key: 'created', label: 'Added', color: SERIES[6]! },
                { key: 'tasks', label: 'Completed', color: SERIES[2]! },
              ]}
              height={240}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={<ListChecks />} title="Done vs still to do, by type" />
          <CardBody>
            <ProgressRows
              rows={s.categories.map((c) => ({
                key: c.category,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <span className={`size-2 rounded-full ${CATEGORY_MAP[c.category].dot}`} />
                    {c.label}
                    <span className="text-xs text-muted-foreground">{c.open} pending</span>
                  </span>
                ),
                done: c.completed,
                total: c.total,
                color: SERIES[2],
              }))}
              empty={<p className="text-sm text-muted-foreground">No planner items yet.</p>}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Layers />} title="Status breakdown" description={`${items.length} items`} />
          <CardBody>
            <SegmentBar segments={s.statuses} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader icon={<GraduationCap />} title="Academic" description={`${s.academic.percent}% mastery`} />
          <CardBody>
            <ProgressRows
              rows={academics.tree
                .filter((x) => !x.archived)
                .map((x) => ({ key: x.id, label: x.code || x.name, done: x.stats.completed, total: x.stats.total, color: subjectColor(x.color).hex }))}
              empty={<p className="text-sm text-muted-foreground">No subjects yet.</p>}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Code2 />} title="DSA" description={`${s.dsa.solved}/${s.dsa.total} solved`} />
          <CardBody className="space-y-4">
            <ProgressRows rows={s.dsa.byDifficulty.filter((b) => b.total > 0).map((b, i) => ({ key: b.key, label: b.label, done: b.done, total: b.total, color: b.key === '_none' ? 'var(--chart-muted)' : [SERIES[2], SERIES[3], SERIES[7]][i] }))} empty={<p className="text-sm text-muted-foreground">No DSA items.</p>} />
            {s.apt.total > 0 && (
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Aptitude · {s.apt.done}/{s.apt.total}
                  {s.apt.averageScore !== null && ` · mock avg ${s.apt.averageScore}%`}
                </p>
                <ProgressRows rows={s.apt.sections.filter((x) => x.total > 0).map((x) => ({ key: x.key, label: x.label, done: x.done, total: x.total, color: SERIES[4] }))} />
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<FolderKanban />} title="Projects" description={`${s.projects.averageProgress}% average progress`} />
          <CardBody>
            <ProgressRows
              rows={items
                .filter((i) => i.category === 'project' && i.status !== 'cancelled')
                .map((p) => ({ key: p.id, label: p.title, done: p.progress, total: 100, suffix: `${p.progress}%`, color: SERIES[6] }))}
              empty={<p className="text-sm text-muted-foreground">No projects yet.</p>}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<BadgeCheck />} title="Certifications" description={`${s.certs.earned} earned of ${s.certs.total}`} />
          <CardBody>
            <ProgressRows
              rows={items
                .filter((i) => i.category === 'certification' && i.status !== 'cancelled')
                .map((c) => ({ key: c.id, label: c.title, done: c.progress, total: 100, suffix: c.status === 'completed' ? 'Earned' : `${c.progress}%`, color: SERIES[3] }))}
              empty={<p className="text-sm text-muted-foreground">No certifications yet.</p>}
            />
            {s.certs.expiringSoon > 0 && <p className="mt-3 text-xs text-warning">{s.certs.expiringSoon} certification(s) expire within 60 days.</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader icon={<CalendarClock />} title="Upcoming deadlines" description="Next 14 days" />
        <CardBody>
          {s.deadlines.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Item</th>
                    <th className="py-2 pr-3 font-medium">Category</th>
                    <th className="py-2 pr-3 font-medium">Priority</th>
                    <th className="py-2 pr-3 font-medium">Progress</th>
                    <th className="py-2 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {s.deadlines.map((it) => (
                    <tr key={it.id} className="border-b border-border last:border-0">
                      <td className="max-w-64 py-2 pr-3">
                        <button onClick={() => editor.edit(it)} className="cursor-pointer truncate text-left font-medium hover:underline">
                          {it.title}
                        </button>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{CATEGORY_MAP[it.category].label}</td>
                      <td className="py-2 pr-3">
                        <PriorityFlag priority={it.priority} showLabel />
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{it.progress}%</td>
                      <td className="py-2">
                        <DueLabel item={it} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No deadlines in the next two weeks.</p>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
