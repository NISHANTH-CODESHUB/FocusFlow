import { Award, BadgeCheck, Brain, Briefcase, Code2, ExternalLink, FolderKanban, GitBranch, LayoutGrid, Paperclip, Plus, Sparkles, Trophy } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppShell'
import { ProgressRows, Ring, SegmentBar, SERIES } from '@/components/shared/charts'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu'
import { Card, CardBody, CardHeader, EmptyState, ErrorState, ListSkeleton, Progress, Stat } from '@/components/ui/misc'
import { formatDate } from '@/lib/dates'
import { cn, pluralize } from '@/lib/utils'
import type { Item, ItemCategory } from '@/types/database'
import { useItems, useUpdateItem } from '../items/api'
import { DueLabel, StatusBadge } from '../items/components'
import { CATEGORY_MAP, DSA_DIFFICULTY, DSA_TOPICS, INTERNSHIP_STAGES } from '../items/config'
import { useItemEditor } from '../items/editor'
import { useAttachmentCounts } from '../items/hooks'
import { ItemActions } from '../items/ItemRow'
import { ItemList } from '../items/ItemList'
import { detail, detailList } from '../items/schema'
import { compareItems, isOpen } from '../items/selectors'
import { aptitudeStats, certificationStats, dsaStats, internshipPipeline, projectStats } from '../stats/compute'
import { useAchievements, useSkills } from './api'
import { AchievementsPanel, SkillsPanel } from './SkillsAchievements'

const TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutGrid },
  { value: 'dsa', label: 'DSA', icon: Code2 },
  { value: 'aptitude', label: 'Aptitude', icon: Brain },
  { value: 'certifications', label: 'Certifications', icon: BadgeCheck },
  { value: 'projects', label: 'Projects', icon: FolderKanban },
  { value: 'internships', label: 'Internships', icon: Briefcase },
  { value: 'hackathons', label: 'Events', icon: Trophy },
  { value: 'skills', label: 'Skills', icon: Sparkles },
  { value: 'achievements', label: 'Achievements', icon: Award },
] as const
type Tab = (typeof TABS)[number]['value']

export default function CareerPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'overview') as Tab
  const { data, isLoading, error, refetch } = useItems()
  const items = useMemo(() => data ?? [], [data])

  const setTab = (t: string) =>
    setParams(
      (p) => {
        p.set('tab', t)
        return p
      },
      { replace: true },
    )

  return (
    <div>
      <PageHeader title="Career & skills" description="Placement prep, certifications, projects, internships and everything you're building toward." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value}>
              <Icon /> {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <TabsContent value="overview">
              <Overview items={items} onNavigate={setTab} />
            </TabsContent>
            <TabsContent value="dsa">
              <DsaTab items={items} />
            </TabsContent>
            <TabsContent value="aptitude">
              <AptitudeTab items={items} />
            </TabsContent>
            <TabsContent value="certifications">
              <CardGridTab items={items} category="certification" empty="Track certifications you're pursuing and attach the certificate when earned." render={(it) => <CertificationCard item={it} />} />
            </TabsContent>
            <TabsContent value="projects">
              <CardGridTab items={items} category="project" empty="Add academic and personal projects — with repo links, stack and progress." render={(it) => <ProjectCard item={it} />} />
            </TabsContent>
            <TabsContent value="internships">
              <InternshipsTab items={items} />
            </TabsContent>
            <TabsContent value="hackathons">
              <EventsTab items={items} />
            </TabsContent>
            <TabsContent value="skills">
              <SkillsPanel />
            </TabsContent>
            <TabsContent value="achievements">
              <AchievementsPanel />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}

/* -------------------------------- Overview ------------------------------- */

function Overview({ items, onNavigate }: { items: Item[]; onNavigate: (tab: string) => void }) {
  const editor = useItemEditor()
  const add = (label: string, run: () => void) => (
    <Button size="sm" variant="outline" onClick={run}>
      <Plus /> {label}
    </Button>
  )
  const dsa = dsaStats(items)
  const apt = aptitudeStats(items)
  const certs = certificationStats(items)
  const projects = projectStats(items)
  const pipeline = internshipPipeline(items)
  const { data: skills } = useSkills()
  const { data: achievements } = useAchievements()
  const applications = pipeline.filter((p) => p.stage !== 'wishlist').reduce((s, p) => s + p.count, 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="DSA solved" value={dsa.solved} hint={`of ${dsa.total} tracked`} icon={<Code2 />} onClick={() => onNavigate('dsa')} />
        <Stat label="Aptitude" value={apt.averageScore !== null ? `${apt.averageScore}%` : `${apt.done}/${apt.total}`} hint={apt.averageScore !== null ? 'Mock average' : 'Topics done'} icon={<Brain />} onClick={() => onNavigate('aptitude')} />
        <Stat label="Certifications" value={certs.earned} hint={`${certs.inProgress} in progress`} icon={<BadgeCheck />} onClick={() => onNavigate('certifications')} />
        <Stat label="Projects" value={projects.total} hint={`${projects.active} active · ${projects.done} shipped`} icon={<FolderKanban />} onClick={() => onNavigate('projects')} />
        <Stat label="Applications" value={applications} hint={`${pipeline.find((p) => p.stage === 'offer')?.count ?? 0} offers`} icon={<Briefcase />} onClick={() => onNavigate('internships')} />
        <Stat label="Skills" value={skills?.length ?? 0} hint={`${achievements?.length ?? 0} achievements`} icon={<Sparkles />} onClick={() => onNavigate('skills')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Briefcase />} title="Internship pipeline" description="Applications by stage" />
          <CardBody>
            {pipeline.some((p) => p.count > 0) ? (
              <PipelineStrip pipeline={pipeline} />
            ) : (
              <EmptyState compact icon={<Briefcase />} title="No applications yet" description="Track internships from wishlist to offer." action={add('Add internship', () => editor.create({ category: 'internship' }))} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Code2 />} title="DSA by difficulty" description={`${dsa.solved} solved of ${dsa.total}`} />
          <CardBody>
            <ProgressRows
              rows={dsa.byDifficulty.filter((b) => b.total > 0).map((b, i) => ({ key: b.key, label: b.label, done: b.done, total: b.total, color: b.key === '_none' ? 'var(--chart-muted)' : [SERIES[2], SERIES[3], SERIES[7]][i] }))}
              empty={<EmptyState compact icon={<Code2 />} title="No DSA problems yet" action={add('Log a problem', () => editor.create({ category: 'dsa' }))} />}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<FolderKanban />} title="Project progress" />
          <CardBody>
            <ProgressRows
              rows={items
                .filter((i) => i.category === 'project' && i.status !== 'cancelled')
                .sort(compareItems('due'))
                .slice(0, 6)
                .map((p) => ({ key: p.id, label: p.title, done: p.progress, total: 100, suffix: `${p.progress}%`, color: SERIES[6] }))}
              empty={<EmptyState compact icon={<FolderKanban />} title="No projects yet" action={add('Add project', () => editor.create({ category: 'project' }))} />}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Award />} title="Recent achievements" />
          <CardBody>
            {achievements?.length ? (
              <ul className="space-y-2">
                {achievements.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{a.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(a.achieved_on, 'MMM yyyy')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<Award />} title="No achievements logged" action={add('Add achievement', () => onNavigate('achievements'))} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function PipelineStrip({ pipeline }: { pipeline: ReturnType<typeof internshipPipeline> }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-3 gap-2 @xl:grid-cols-6">
      {pipeline.map((p) => (
        <div key={p.stage} className={cn('rounded-lg border border-border p-2.5 text-center', p.stage === 'offer' && p.count > 0 && 'border-success/40 bg-success/5')}>
          <div className="text-xl font-semibold tabular-nums">{p.count}</div>
          <div className="truncate text-[11px] text-muted-foreground">{p.label}</div>
        </div>
      ))}
      </div>
    </div>
  )
}

/* ---------------------------------- Shared --------------------------------- */

function TabToolbar({ category, children, count }: { category: ItemCategory; children?: ReactNode; count: number }) {
  const editor = useItemEditor()
  const c = CATEGORY_MAP[category]
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <p className="mr-auto text-sm text-muted-foreground">{pluralize(count, c.label.toLowerCase())}</p>
      {children}
      <Button onClick={() => editor.create({ category })}>
        <Plus /> {c.label}
      </Button>
    </div>
  )
}

type StatusFilter = 'open' | 'done' | 'all'
const statusFilterOptions = [
  { value: 'open' as const, label: 'Open' },
  { value: 'done' as const, label: 'Done' },
  { value: 'all' as const, label: 'All' },
]
const byStatus = (f: StatusFilter) => (it: Item) => (f === 'all' ? true : f === 'open' ? isOpen(it) : it.status === 'completed')

/* ----------------------------------- DSA ---------------------------------- */

function DsaTab({ items }: { items: Item[] }) {
  const editor = useItemEditor()
  const stats = dsaStats(items)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const list = items
    .filter((i) => i.category === 'dsa')
    .filter(byStatus(status))
    .filter((i) => !topic || detail(i, 'topic') === topic)
    .filter((i) => !difficulty || detail(i, 'difficulty') === difficulty)
    .sort(compareItems('created'))

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Card className="flex items-center gap-4 p-4">
          <Ring value={stats.percent} size={64} label="DSA solved" />
          <div>
            <p className="text-2xl font-semibold tabular-nums">
              {stats.solved}
              <span className="text-base font-normal text-muted-foreground">/{stats.total}</span>
            </p>
            <p className="text-xs text-muted-foreground">problems & topics done</p>
          </div>
        </Card>
        <Card>
          <CardHeader title="By difficulty" description="Solved counts" />
          <CardBody>
            <SegmentBar
              segments={stats.byDifficulty
                .filter((b) => b.key !== '_none')
                .map((b, i) => ({ key: b.key, label: b.label, value: b.done, color: [SERIES[2]!, SERIES[3]!, SERIES[7]!][i]! }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="By topic" />
          <CardBody>
            <ProgressRows rows={stats.byTopic.map((t) => ({ key: t.key, label: t.label, done: t.done, total: t.total, color: SERIES[0] }))} empty={<p className="text-sm text-muted-foreground">Tag problems with a topic to see coverage.</p>} />
          </CardBody>
        </Card>
        {stats.byPlatform.length > 0 && (
          <Card>
            <CardHeader title="By platform" />
            <CardBody>
              <ProgressRows rows={stats.byPlatform.map((t) => ({ key: t.key, label: t.label, done: t.done, total: t.total, color: SERIES[6] }))} />
            </CardBody>
          </Card>
        )}
      </div>
      <div>
        <TabToolbar category="dsa" count={list.length}>
          <Select aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-40">
            <option value="">All topics</option>
            {DSA_TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <Select aria-label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-32">
            <option value="">Any level</option>
            {DSA_DIFFICULTY.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
          <Segmented ariaLabel="Status" value={status} onChange={setStatus} options={statusFilterOptions} />
        </TabToolbar>
        <Card className="px-3 py-1">
          {list.length ? <ItemList items={list} hideCategory /> : <EmptyState compact className="my-3 border-none" icon={<Code2 />} title="No problems here" description="Log problems as you solve them, with topic, difficulty and link." action={<Button size="sm" onClick={() => editor.create({ category: 'dsa' })}><Plus /> Log a problem</Button>} />}
        </Card>
      </div>
    </div>
  )
}

/* -------------------------------- Aptitude -------------------------------- */

function AptitudeTab({ items }: { items: Item[] }) {
  const editor = useItemEditor()
  const stats = aptitudeStats(items)
  const [status, setStatus] = useState<StatusFilter>('all')
  const list = items.filter((i) => i.category === 'aptitude').filter(byStatus(status)).sort(compareItems('due'))
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Card className="grid grid-cols-2 divide-x divide-border">
          <div className="p-4">
            <p className="text-2xl font-semibold tabular-nums">{stats.averageScore !== null ? `${stats.averageScore}%` : '—'}</p>
            <p className="text-xs text-muted-foreground">Mock average ({stats.mocks})</p>
          </div>
          <div className="p-4">
            <p className="text-2xl font-semibold tabular-nums">
              {stats.done}/{stats.total}
            </p>
            <p className="text-xs text-muted-foreground">Topics completed</p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Sections" />
          <CardBody>
            <ProgressRows rows={stats.sections.filter((s) => s.total > 0).map((s) => ({ key: s.key, label: s.label, done: s.done, total: s.total, color: SERIES[4] }))} empty={<p className="text-sm text-muted-foreground">Add aptitude topics with a section to see coverage.</p>} />
          </CardBody>
        </Card>
      </div>
      <div>
        <TabToolbar category="aptitude" count={list.length}>
          <Segmented ariaLabel="Status" value={status} onChange={setStatus} options={statusFilterOptions} />
        </TabToolbar>
        <Card className="px-3 py-1">
          {list.length ? <ItemList items={list} hideCategory /> : <EmptyState compact className="my-3 border-none" icon={<Brain />} title="No aptitude prep yet" description="Add topics like Time & Work or mock test results with scores." action={<Button size="sm" onClick={() => editor.create({ category: 'aptitude' })}><Plus /> Add topic</Button>} />}
        </Card>
      </div>
    </div>
  )
}

/* ------------------------ Certifications & projects ------------------------ */

function CardGridTab({ items, category, empty, render }: { items: Item[]; category: ItemCategory; empty: string; render: (it: Item) => ReactNode }) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const editor = useItemEditor()
  const list = items.filter((i) => i.category === category).filter(byStatus(status)).sort(compareItems('due'))
  const c = CATEGORY_MAP[category]
  return (
    <div>
      <TabToolbar category={category} count={list.length}>
        <Segmented ariaLabel="Status" value={status} onChange={setStatus} options={statusFilterOptions} />
      </TabToolbar>
      {list.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.map((it) => <div key={it.id}>{render(it)}</div>)}</div>
      ) : (
        <EmptyState icon={<c.icon />} title={`No ${c.plural.toLowerCase()} here`} description={empty} action={<Button onClick={() => editor.create({ category })}><Plus /> Add {c.label.toLowerCase()}</Button>} />
      )}
    </div>
  )
}

function CardShell({ item, children, footer }: { item: Item; children?: ReactNode; footer?: ReactNode }) {
  const editor = useItemEditor()
  const attachments = useAttachmentCounts().get(item.id) ?? 0
  return (
    <Card className="group flex h-full flex-col p-4">
      <div className="flex items-start gap-2">
        <button onClick={() => editor.edit(item)} className="min-w-0 flex-1 cursor-pointer text-left">
          <p className="font-medium hover:underline">{item.title}</p>
        </button>
        <ItemActions item={item} className="-mt-1 -mr-1" />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <StatusBadge status={item.status} />
        <DueLabel item={item} />
        {attachments > 0 && (
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
            <Paperclip className="size-3" /> {attachments}
          </span>
        )}
      </div>
      <div className="mt-3 flex-1 space-y-2 text-sm">{children}</div>
      {footer && <div className="mt-3 border-t border-border pt-3">{footer}</div>}
    </Card>
  )
}

function LinkOut({ href, icon, label }: { href?: string; icon: ReactNode; label: string }) {
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline [&_svg]:size-3.5">
      {icon} {label}
    </a>
  )
}

function CertificationCard({ item }: { item: Item }) {
  const issuer = detail(item, 'issuer')
  const issued = detail(item, 'issued_on')
  const expires = detail(item, 'expires_on')
  return (
    <CardShell
      item={item}
      footer={
        <div className="flex items-center gap-3">
          <Progress value={item.progress} size="xs" label="Progress" />
          <span className="text-xs text-muted-foreground tabular-nums">{item.progress}%</span>
        </div>
      }
    >
      {issuer && <p className="text-muted-foreground">{issuer}</p>}
      {(issued || expires) && (
        <p className="text-xs text-muted-foreground">
          {issued && `Issued ${formatDate(issued)}`}
          {issued && expires && ' · '}
          {expires && `Expires ${formatDate(expires)}`}
        </p>
      )}
      {detail(item, 'credential_id') && <p className="font-mono text-xs text-muted-foreground">ID: {detail(item, 'credential_id')}</p>}
      <LinkOut href={detail(item, 'credential_url')} icon={<ExternalLink />} label="Verify credential" />
    </CardShell>
  )
}

function ProjectCard({ item }: { item: Item }) {
  const stack = detailList(item, 'tech_stack')
  return (
    <CardShell
      item={item}
      footer={
        <div className="flex items-center gap-3">
          <Progress value={item.progress} size="xs" label="Progress" />
          <span className="text-xs text-muted-foreground tabular-nums">{item.progress}%</span>
        </div>
      }
    >
      {item.description && <p className="line-clamp-2 text-muted-foreground">{item.description}</p>}
      {stack.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {stack.map((t) => (
            <span key={t} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        <LinkOut href={detail(item, 'repo_url')} icon={<GitBranch />} label="Repo" />
        <LinkOut href={detail(item, 'live_url')} icon={<ExternalLink />} label="Live" />
      </div>
    </CardShell>
  )
}

/* ------------------------------- Internships ------------------------------ */

function InternshipsTab({ items }: { items: Item[] }) {
  const update = useUpdateItem()
  const editor = useItemEditor()
  const list = items.filter((i) => i.category === 'internship').sort(compareItems('due'))
  const pipeline = internshipPipeline(items)

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="pt-4">
          <PipelineStrip pipeline={pipeline} />
        </CardBody>
      </Card>
      <TabToolbar category="internship" count={list.length} />
      {list.length === 0 ? (
        <EmptyState icon={<Briefcase />} title="No applications tracked" description="Track every internship from wishlist to offer, with deadlines and links." action={<Button onClick={() => editor.create({ category: 'internship' })}><Plus /> Add internship</Button>} />
      ) : (
        <Card className="divide-y divide-border">
          {list.map((it) => {
            const stage = detail(it, 'stage') ?? 'wishlist'
            const company = detail(it, 'company')
            const role = detail(it, 'role')
            return (
              <div key={it.id} className="group flex flex-wrap items-center gap-3 px-4 py-3">
                <button onClick={() => editor.edit(it)} className="min-w-0 flex-1 cursor-pointer text-left">
                  <p className="truncate text-sm font-medium">{it.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{[company, role, detail(it, 'location')].filter(Boolean).join(' · ') || 'Add company & role'}</p>
                </button>
                <DueLabel item={it} />
                <Select
                  aria-label={`Stage for ${it.title}`}
                  value={stage}
                  onChange={(e) => {
                    const next = e.target.value
                    const details = typeof it.details === 'object' && it.details && !Array.isArray(it.details) ? it.details : {}
                    const status = next === 'offer' ? 'completed' : next === 'rejected' ? 'cancelled' : next === 'wishlist' ? 'todo' : 'in_progress'
                    update.mutate({ id: it.id, patch: { details: { ...details, stage: next }, status } })
                  }}
                  className="w-36"
                >
                  {INTERNSHIP_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <ItemActions item={it} />
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

/* --------------------------- Hackathons & events --------------------------- */

function EventsTab({ items }: { items: Item[] }) {
  const editor = useItemEditor()
  const list = items.filter((i) => i.category === 'hackathon' || i.category === 'event').sort(compareItems('due'))
  const upcomingList = list.filter(isOpen)
  const past = list.filter((i) => !isOpen(i)).reverse()
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">{pluralize(list.length, 'hackathon or event', 'hackathons & events')}</p>
        <Button variant="outline" onClick={() => editor.create({ category: 'event' })}>
          <Plus /> Event
        </Button>
        <Button onClick={() => editor.create({ category: 'hackathon' })}>
          <Plus /> Hackathon
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Trophy />} title="No hackathons or events yet" description="Add hackathons, workshops, fests and tech talks you plan to attend." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Upcoming & ongoing" description={pluralize(upcomingList.length, 'event')} />
            <CardBody>{upcomingList.length ? <ItemList items={upcomingList} /> : <p className="text-sm text-muted-foreground">Nothing upcoming.</p>}</CardBody>
          </Card>
          <Card>
            <CardHeader title="Past" description="Completed or closed" />
            <CardBody>
              {past.length ? (
                <ul className="space-y-2">
                  {past.map((it) => (
                    <li key={it.id}>
                      <button onClick={() => editor.edit(it)} className="w-full cursor-pointer rounded-lg px-2 py-1.5 text-left hover:bg-accent">
                        <span className="block truncate text-sm font-medium">{it.title}</span>
                        <span className="block text-xs text-muted-foreground">{[detail(it, 'result'), detail(it, 'organizer'), formatDate(it.due_at)].filter(Boolean).join(' · ')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No past events yet.</p>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
