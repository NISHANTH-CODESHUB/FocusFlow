import { endOfDay, startOfDay } from 'date-fns'
import { formatDate, parseLocalDate, toDate } from '@/lib/dates'
import type { Achievement, Concept, Item, Skill, Subject, Unit } from '@/types/database'
import { buildAcademicTree } from '../academics/tree'
import { CATEGORY_MAP, INTERNSHIP_STAGES, PRIORITY_MAP, STATUS_MAP, optionLabel } from '../items/config'
import { detail, detailList } from '../items/schema'
import { categoryBreakdown, completionSeries, streaks, summarize } from '../stats/compute'

export type Cell = string | number
export interface Column {
  key: string
  header: string
  width?: number
}
export interface Dataset {
  key: SectionKey
  title: string
  columns: Column[]
  rows: Array<Record<string, Cell>>
}

export type SectionKey = 'summary' | 'tasks' | 'academics' | 'study_plan' | 'projects' | 'certifications' | 'dsa' | 'aptitude' | 'internships' | 'events' | 'skills' | 'achievements' | 'productivity'

export const SECTIONS: ReadonlyArray<{ key: SectionKey; label: string; description: string }> = [
  { key: 'summary', label: 'Summary', description: 'Headline numbers and streaks' },
  { key: 'tasks', label: 'Planner items', description: 'Tasks, tests, labs, assignments & more' },
  { key: 'academics', label: 'Academic progress', description: 'Completion per subject' },
  { key: 'study_plan', label: 'Study plan', description: 'Every concept with status and revision date' },
  { key: 'projects', label: 'Projects', description: 'Progress, stack and links' },
  { key: 'certifications', label: 'Certifications', description: 'Issuers, status and credentials' },
  { key: 'dsa', label: 'DSA practice', description: 'Problems by topic and difficulty' },
  { key: 'aptitude', label: 'Aptitude prep', description: 'Sections and mock scores' },
  { key: 'internships', label: 'Internships', description: 'Applications and stages' },
  { key: 'events', label: 'Hackathons & events', description: 'Participation and results' },
  { key: 'skills', label: 'Skills', description: 'Levels and learning progress' },
  { key: 'achievements', label: 'Achievements', description: 'Awards and milestones' },
  { key: 'productivity', label: 'Productivity statistics', description: 'Monthly completions and category breakdown' },
]

export interface ExportSource {
  items: Item[]
  subjects: Subject[]
  units: Unit[]
  concepts: Concept[]
  skills: Skill[]
  achievements: Achievement[]
}

export interface ExportOptions {
  sections: SectionKey[]
  /** Restricts planner items by due date (items without a date are kept). */
  from?: string
  to?: string
  includeCompleted: boolean
}

const d = (v: string | null | undefined) => (v ? formatDate(v, 'dd MMM yyyy') : '')

function inRange(item: Item, opts: ExportOptions): boolean {
  if (!opts.includeCompleted && (item.status === 'completed' || item.status === 'cancelled')) return false
  const due = toDate(item.due_at)
  if (!due) return true
  const from = parseLocalDate(opts.from)
  const to = parseLocalDate(opts.to)
  if (from && due < startOfDay(from)) return false
  if (to && due > endOfDay(to)) return false
  return true
}

const status = (it: Item) => STATUS_MAP[it.status].label

export function buildDatasets(src: ExportSource, opts: ExportOptions, now = new Date()): Dataset[] {
  const items = src.items.filter((it) => inRange(it, opts))
  const subjectName = new Map(src.subjects.map((s) => [s.id, s.code ? `${s.code} ${s.name}` : s.name]))
  const ofCategory = (...cats: Item['category'][]) => items.filter((it) => cats.includes(it.category))
  const tree = buildAcademicTree(src)
  const out: Dataset[] = []

  for (const key of opts.sections) {
    switch (key) {
      case 'summary': {
        const s = summarize(src.items, now)
        const st = streaks(src.items, src.concepts, now)
        const concepts = tree.reduce((a, x) => a + x.stats.total, 0)
        const mastered = tree.reduce((a, x) => a + x.stats.completed, 0)
        out.push({
          key,
          title: 'Summary',
          columns: [
            { key: 'metric', header: 'Metric', width: 36 },
            { key: 'value', header: 'Value', width: 18 },
          ],
          rows: [
            { metric: 'Planner items', value: s.total },
            { metric: 'Completed', value: s.completed },
            { metric: 'Pending', value: s.open },
            { metric: 'Overdue', value: s.overdue },
            { metric: 'Completion rate', value: `${s.completionRate}%` },
            { metric: 'Completed this week', value: s.completedThisWeek },
            { metric: 'Subjects', value: src.subjects.filter((x) => !x.archived).length },
            { metric: 'Concepts mastered', value: `${mastered} / ${concepts}` },
            { metric: 'Current streak (days)', value: st.current },
            { metric: 'Best streak (days)', value: st.best },
          ],
        })
        break
      }
      case 'tasks':
        out.push({
          key,
          title: 'Planner items',
          columns: [
            { key: 'title', header: 'Title', width: 38 },
            { key: 'category', header: 'Category', width: 14 },
            { key: 'status', header: 'Status', width: 13 },
            { key: 'priority', header: 'Priority', width: 10 },
            { key: 'due', header: 'Due', width: 13 },
            { key: 'progress', header: 'Progress %', width: 11 },
            { key: 'subject', header: 'Subject', width: 20 },
            { key: 'tags', header: 'Tags', width: 18 },
            { key: 'completed', header: 'Completed on', width: 14 },
          ],
          rows: [...items]
            .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'))
            .map((it) => ({
              title: it.title,
              category: CATEGORY_MAP[it.category].label,
              status: status(it),
              priority: PRIORITY_MAP[it.priority].label,
              due: d(it.due_at),
              progress: it.progress,
              subject: it.subject_id ? (subjectName.get(it.subject_id) ?? '') : '',
              tags: it.tags.join(', '),
              completed: d(it.completed_at),
            })),
        })
        break
      case 'academics':
        out.push({
          key,
          title: 'Academic progress',
          columns: [
            { key: 'subject', header: 'Subject', width: 30 },
            { key: 'semester', header: 'Semester', width: 12 },
            { key: 'units', header: 'Units', width: 8 },
            { key: 'concepts', header: 'Concepts', width: 10 },
            { key: 'completed', header: 'Completed', width: 11 },
            { key: 'learning', header: 'Learning', width: 10 },
            { key: 'not_started', header: 'Not started', width: 12 },
            { key: 'percent', header: 'Progress %', width: 11 },
          ],
          rows: tree.map((s) => ({
            subject: s.code ? `${s.code} ${s.name}` : s.name,
            semester: s.semester ?? '',
            units: s.units.length,
            concepts: s.stats.total,
            completed: s.stats.completed,
            learning: s.stats.learning,
            not_started: s.stats.notStarted,
            percent: s.stats.percent,
          })),
        })
        break
      case 'study_plan':
        out.push({
          key,
          title: 'Study plan',
          columns: [
            { key: 'subject', header: 'Subject', width: 22 },
            { key: 'unit', header: 'Unit', width: 24 },
            { key: 'concept', header: 'Concept', width: 34 },
            { key: 'status', header: 'Status', width: 12 },
            { key: 'revision', header: 'Revise on', width: 13 },
            { key: 'notes', header: 'Notes', width: 40 },
          ],
          rows: tree.flatMap((s) =>
            s.units.flatMap((u) =>
              u.concepts.map((c) => ({
                subject: s.code || s.name,
                unit: u.title,
                concept: c.title,
                status: c.status === 'completed' ? 'Completed' : c.status === 'learning' ? 'Learning' : 'Not started',
                revision: d(c.revision_date),
                notes: (c.notes ?? '').replace(/\s+/g, ' ').slice(0, 200),
              })),
            ),
          ),
        })
        break
      case 'projects':
        out.push({
          key,
          title: 'Projects',
          columns: [
            { key: 'title', header: 'Project', width: 30 },
            { key: 'status', header: 'Status', width: 13 },
            { key: 'progress', header: 'Progress %', width: 11 },
            { key: 'stack', header: 'Tech stack', width: 28 },
            { key: 'repo', header: 'Repository', width: 30 },
            { key: 'live', header: 'Live', width: 26 },
            { key: 'due', header: 'Target', width: 13 },
          ],
          rows: ofCategory('project').map((it) => ({
            title: it.title,
            status: status(it),
            progress: it.progress,
            stack: detailList(it, 'tech_stack').join(', '),
            repo: detail(it, 'repo_url') ?? '',
            live: detail(it, 'live_url') ?? '',
            due: d(it.due_at),
          })),
        })
        break
      case 'certifications':
        out.push({
          key,
          title: 'Certifications',
          columns: [
            { key: 'title', header: 'Certification', width: 32 },
            { key: 'issuer', header: 'Issuer', width: 18 },
            { key: 'status', header: 'Status', width: 13 },
            { key: 'progress', header: 'Progress %', width: 11 },
            { key: 'issued', header: 'Issued', width: 13 },
            { key: 'expires', header: 'Expires', width: 13 },
            { key: 'credential', header: 'Credential ID', width: 18 },
            { key: 'url', header: 'Credential link', width: 30 },
          ],
          rows: ofCategory('certification').map((it) => ({
            title: it.title,
            issuer: detail(it, 'issuer') ?? '',
            status: it.status === 'completed' ? 'Earned' : status(it),
            progress: it.progress,
            issued: d(detail(it, 'issued_on')),
            expires: d(detail(it, 'expires_on')),
            credential: detail(it, 'credential_id') ?? '',
            url: detail(it, 'credential_url') ?? '',
          })),
        })
        break
      case 'dsa': {
        const fields = CATEGORY_MAP.dsa.fields
        const f = (k: string) => fields.find((x) => x.key === k)!
        out.push({
          key,
          title: 'DSA practice',
          columns: [
            { key: 'title', header: 'Problem / topic', width: 38 },
            { key: 'topic', header: 'Topic', width: 20 },
            { key: 'difficulty', header: 'Difficulty', width: 11 },
            { key: 'platform', header: 'Platform', width: 14 },
            { key: 'status', header: 'Status', width: 13 },
            { key: 'url', header: 'Link', width: 30 },
          ],
          rows: ofCategory('dsa').map((it) => ({
            title: it.title,
            topic: detail(it, 'topic') ?? '',
            difficulty: optionLabel(f('difficulty'), detail(it, 'difficulty')),
            platform: optionLabel(f('platform'), detail(it, 'platform')),
            status: status(it),
            url: detail(it, 'url') ?? '',
          })),
        })
        break
      }
      case 'aptitude': {
        const section = CATEGORY_MAP.aptitude.fields.find((x) => x.key === 'section')!
        out.push({
          key,
          title: 'Aptitude prep',
          columns: [
            { key: 'title', header: 'Topic / test', width: 34 },
            { key: 'section', header: 'Section', width: 20 },
            { key: 'status', header: 'Status', width: 13 },
            { key: 'score', header: 'Score', width: 10 },
            { key: 'total', header: 'Out of', width: 10 },
            { key: 'due', header: 'Date', width: 13 },
          ],
          rows: ofCategory('aptitude').map((it) => ({
            title: it.title,
            section: optionLabel(section, detail(it, 'section')),
            status: status(it),
            score: detail(it, 'score') ?? '',
            total: detail(it, 'total') ?? '',
            due: d(it.due_at),
          })),
        })
        break
      }
      case 'internships':
        out.push({
          key,
          title: 'Internships',
          columns: [
            { key: 'title', header: 'Title', width: 28 },
            { key: 'company', header: 'Company', width: 20 },
            { key: 'role', header: 'Role', width: 20 },
            { key: 'stage', header: 'Stage', width: 13 },
            { key: 'location', header: 'Location', width: 16 },
            { key: 'due', header: 'Deadline', width: 13 },
            { key: 'url', header: 'Link', width: 30 },
          ],
          rows: ofCategory('internship').map((it) => ({
            title: it.title,
            company: detail(it, 'company') ?? '',
            role: detail(it, 'role') ?? '',
            stage: INTERNSHIP_STAGES.find((s) => s.value === (detail(it, 'stage') ?? 'wishlist'))?.label ?? '',
            location: detail(it, 'location') ?? '',
            due: d(it.due_at),
            url: detail(it, 'url') ?? '',
          })),
        })
        break
      case 'events':
        out.push({
          key,
          title: 'Hackathons & events',
          columns: [
            { key: 'title', header: 'Name', width: 32 },
            { key: 'type', header: 'Type', width: 12 },
            { key: 'organizer', header: 'Organizer', width: 20 },
            { key: 'start', header: 'Starts', width: 13 },
            { key: 'end', header: 'Ends', width: 13 },
            { key: 'status', header: 'Status', width: 13 },
            { key: 'result', header: 'Result', width: 22 },
          ],
          rows: ofCategory('hackathon', 'event').map((it) => ({
            title: it.title,
            type: CATEGORY_MAP[it.category].label,
            organizer: detail(it, 'organizer') ?? '',
            start: d(it.start_at),
            end: d(it.due_at),
            status: status(it),
            result: detail(it, 'result') ?? '',
          })),
        })
        break
      case 'skills':
        out.push({
          key,
          title: 'Skills',
          columns: [
            { key: 'name', header: 'Skill', width: 26 },
            { key: 'area', header: 'Area', width: 18 },
            { key: 'level', header: 'Level', width: 14 },
            { key: 'progress', header: 'Progress %', width: 11 },
            { key: 'target', header: 'Target', width: 13 },
          ],
          rows: src.skills.map((s) => ({ name: s.name, area: s.area, level: s.level[0]!.toUpperCase() + s.level.slice(1), progress: s.progress, target: d(s.target_date) })),
        })
        break
      case 'achievements':
        out.push({
          key,
          title: 'Achievements',
          columns: [
            { key: 'date', header: 'Date', width: 13 },
            { key: 'title', header: 'Achievement', width: 38 },
            { key: 'kind', header: 'Type', width: 14 },
            { key: 'description', header: 'Description', width: 40 },
          ],
          rows: src.achievements.map((a) => ({ date: d(a.achieved_on), title: a.title, kind: a.kind, description: (a.description ?? '').replace(/\s+/g, ' ') })),
        })
        break
      case 'productivity': {
        const monthly = completionSeries(src.items, src.concepts, '12m', now)
        out.push({
          key,
          title: 'Productivity — last 12 months',
          columns: [
            { key: 'month', header: 'Month', width: 14 },
            { key: 'created', header: 'Items added', width: 13 },
            { key: 'tasks', header: 'Items completed', width: 16 },
            { key: 'concepts', header: 'Concepts completed', width: 18 },
          ],
          rows: monthly.map((p) => ({ month: formatDate(`${p.key}-01`, 'MMM yyyy'), created: p.created, tasks: p.tasks, concepts: p.concepts })),
        })
        out.push({
          key,
          title: 'Completion by category',
          columns: [
            { key: 'category', header: 'Category', width: 22 },
            { key: 'total', header: 'Total', width: 9 },
            { key: 'completed', header: 'Completed', width: 11 },
            { key: 'pending', header: 'Pending', width: 10 },
            { key: 'percent', header: 'Completion %', width: 13 },
          ],
          rows: categoryBreakdown(src.items).map((c) => ({ category: c.label, total: c.total, completed: c.completed, pending: c.open, percent: c.percent })),
        })
        break
      }
    }
  }
  return out
}

export function exportFileName(ext: 'pdf' | 'xlsx', now = new Date()) {
  return `focusflow-report-${formatDate(now, 'yyyy-MM-dd')}.${ext}`
}

export function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
