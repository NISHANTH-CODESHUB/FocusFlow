import {
  BadgeCheck,
  Brain,
  Briefcase,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Code2,
  FlaskConical,
  FolderKanban,
  NotebookPen,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import type { FileFolder, ItemCategory, ItemPriority, ItemStatus } from '@/types/database'

export type DetailFieldType = 'text' | 'url' | 'number' | 'date' | 'select' | 'list'

export interface DetailField {
  key: string
  label: string
  type: DetailFieldType
  options?: ReadonlyArray<{ value: string; label: string }>
  placeholder?: string
  /** Occupies the full form row. */
  wide?: boolean
}

export interface CategoryConfig {
  value: ItemCategory
  label: string
  plural: string
  /** One-line explanation shown when choosing a type. */
  hint: string
  icon: LucideIcon
  /** Tailwind classes for the colored dot / chip. */
  dot: string
  chip: string
  group: 'academic' | 'career' | 'personal'
  /** Where attachments for this category are filed by default. */
  folder: FileFolder
  /** Show a start date alongside the due date (multi-day things). */
  hasStart?: boolean
  dueLabel: string
  fields: DetailField[]
}

const opts = (...values: string[]) => values.map((v) => ({ value: v.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label: v }))

export const DSA_TOPICS = [
  'Arrays',
  'Strings',
  'Hashing',
  'Two Pointers',
  'Sliding Window',
  'Binary Search',
  'Sorting',
  'Recursion & Backtracking',
  'Linked List',
  'Stack & Queue',
  'Trees',
  'Binary Search Trees',
  'Heaps',
  'Graphs',
  'Greedy',
  'Dynamic Programming',
  'Tries',
  'Bit Manipulation',
  'Math',
  'Other',
] as const

export const DSA_DIFFICULTY = opts('Easy', 'Medium', 'Hard')
export const APTITUDE_SECTIONS = opts('Quantitative', 'Logical Reasoning', 'Verbal', 'Data Interpretation')
export const INTERNSHIP_STAGES = [
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'applied', label: 'Applied' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
] as const

export const CATEGORIES: CategoryConfig[] = [
  {
    value: 'task',
    label: 'Task',
    plural: 'Tasks',
    hint: 'Anything you need to get done',
    icon: CheckSquare,
    dot: 'bg-slate-500',
    chip: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
    group: 'personal',
    folder: 'other',
    dueLabel: 'Due',
    fields: [],
  },
  {
    value: 'test',
    label: 'Test',
    plural: 'Tests & exams',
    hint: 'Exams, internals, quizzes and viva',
    icon: ClipboardCheck,
    dot: 'bg-red-500',
    chip: 'bg-red-500/10 text-red-700 dark:text-red-400',
    group: 'academic',
    folder: 'academic',
    dueLabel: 'Test date',
    fields: [
      { key: 'syllabus', label: 'Syllabus / portions', type: 'text', wide: true, placeholder: 'Units 1–3' },
      { key: 'venue', label: 'Venue', type: 'text', placeholder: 'Room 204' },
      { key: 'max_marks', label: 'Max marks', type: 'number' },
      { key: 'score', label: 'Score obtained', type: 'number' },
    ],
  },
  {
    value: 'lab',
    label: 'Lab',
    plural: 'Labs',
    hint: 'Lab sessions, experiments and records',
    icon: FlaskConical,
    dot: 'bg-teal-500',
    chip: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
    group: 'academic',
    folder: 'academic',
    dueLabel: 'Lab date',
    fields: [
      { key: 'experiment', label: 'Experiment', type: 'text', wide: true, placeholder: 'Exp 5 — Process scheduling' },
      { key: 'venue', label: 'Lab / venue', type: 'text' },
      { key: 'record_submitted', label: 'Record', type: 'select', options: opts('Pending', 'Submitted', 'Signed') },
    ],
  },
  {
    value: 'assignment',
    label: 'Assignment',
    plural: 'Assignments',
    hint: 'Homework and submissions with a deadline',
    icon: NotebookPen,
    dot: 'bg-amber-500',
    chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    group: 'academic',
    folder: 'academic',
    dueLabel: 'Submission',
    fields: [
      { key: 'submission_url', label: 'Submission link', type: 'url', wide: true, placeholder: 'https://classroom…' },
      { key: 'max_marks', label: 'Max marks', type: 'number' },
      { key: 'score', label: 'Score obtained', type: 'number' },
    ],
  },
  {
    value: 'project',
    label: 'Project',
    plural: 'Projects',
    hint: 'College or personal projects you build over weeks',
    icon: FolderKanban,
    dot: 'bg-violet-500',
    chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
    group: 'career',
    folder: 'projects',
    hasStart: true,
    dueLabel: 'Target date',
    fields: [
      { key: 'tech_stack', label: 'Tech stack', type: 'list', wide: true, placeholder: 'React, Supabase, Tailwind' },
      { key: 'repo_url', label: 'Repository', type: 'url', placeholder: 'https://github.com/…' },
      { key: 'live_url', label: 'Live demo', type: 'url', placeholder: 'https://…' },
      { key: 'team', label: 'Team', type: 'text', wide: true, placeholder: 'Solo or teammates' },
    ],
  },
  {
    value: 'hackathon',
    label: 'Hackathon',
    plural: 'Hackathons',
    hint: 'Coding competitions you take part in with a team',
    icon: Trophy,
    dot: 'bg-orange-500',
    chip: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    group: 'career',
    folder: 'certificates',
    hasStart: true,
    dueLabel: 'Ends / submission',
    fields: [
      { key: 'organizer', label: 'Organizer', type: 'text' },
      { key: 'mode', label: 'Mode', type: 'select', options: opts('Online', 'Offline', 'Hybrid') },
      { key: 'url', label: 'Event link', type: 'url', placeholder: 'https://devpost.com/…' },
      { key: 'team', label: 'Team', type: 'text' },
      { key: 'result', label: 'Result', type: 'text', wide: true, placeholder: 'Finalist, Winner, Participated…' },
    ],
  },
  {
    value: 'event',
    label: 'Event',
    plural: 'Events',
    hint: 'Workshops, fests, seminars and talks to attend',
    icon: CalendarDays,
    dot: 'bg-pink-500',
    chip: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
    group: 'career',
    folder: 'other',
    hasStart: true,
    dueLabel: 'Date',
    fields: [
      { key: 'organizer', label: 'Organizer', type: 'text' },
      { key: 'venue', label: 'Venue', type: 'text' },
      { key: 'url', label: 'Link', type: 'url', wide: true },
    ],
  },
  {
    value: 'internship',
    label: 'Internship',
    plural: 'Internships',
    hint: 'Internship applications, from wishlist to offer',
    icon: Briefcase,
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    group: 'career',
    folder: 'important',
    hasStart: true,
    dueLabel: 'Apply by / next step',
    fields: [
      { key: 'company', label: 'Company', type: 'text', placeholder: 'Acme Inc.' },
      { key: 'role', label: 'Role', type: 'text', placeholder: 'SDE Intern' },
      { key: 'stage', label: 'Stage', type: 'select', options: INTERNSHIP_STAGES },
      { key: 'location', label: 'Location', type: 'text', placeholder: 'Remote / Bengaluru' },
      { key: 'stipend', label: 'Stipend', type: 'text' },
      { key: 'url', label: 'Posting link', type: 'url' },
    ],
  },
  {
    value: 'dsa',
    label: 'DSA',
    plural: 'DSA practice',
    hint: 'Coding problems and topics for placements',
    icon: Code2,
    dot: 'bg-sky-500',
    chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
    group: 'career',
    folder: 'study',
    dueLabel: 'Target date',
    fields: [
      { key: 'topic', label: 'Topic', type: 'select', options: DSA_TOPICS.map((t) => ({ value: t, label: t })) },
      { key: 'difficulty', label: 'Difficulty', type: 'select', options: DSA_DIFFICULTY },
      {
        key: 'platform',
        label: 'Platform',
        type: 'select',
        options: opts('LeetCode', 'GeeksforGeeks', 'Codeforces', 'CodeChef', 'HackerRank', 'InterviewBit', 'Other'),
      },
      { key: 'url', label: 'Problem link', type: 'url' },
    ],
  },
  {
    value: 'aptitude',
    label: 'Aptitude',
    plural: 'Aptitude prep',
    hint: 'Aptitude topics and mock test scores',
    icon: Brain,
    dot: 'bg-fuchsia-500',
    chip: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400',
    group: 'career',
    folder: 'study',
    dueLabel: 'Target date',
    fields: [
      { key: 'section', label: 'Section', type: 'select', options: APTITUDE_SECTIONS },
      { key: 'topic', label: 'Topic', type: 'text', placeholder: 'Time & Work' },
      { key: 'score', label: 'Mock score', type: 'number' },
      { key: 'total', label: 'Out of', type: 'number' },
    ],
  },
  {
    value: 'certification',
    label: 'Certification',
    plural: 'Certifications',
    hint: 'Online courses and certificates you are earning',
    icon: BadgeCheck,
    dot: 'bg-yellow-500',
    chip: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    group: 'career',
    folder: 'certificates',
    hasStart: true,
    dueLabel: 'Target completion',
    fields: [
      { key: 'issuer', label: 'Issuer', type: 'text', placeholder: 'AWS, Google, Coursera…' },
      { key: 'credential_id', label: 'Credential ID', type: 'text' },
      { key: 'credential_url', label: 'Credential link', type: 'url', wide: true },
      { key: 'issued_on', label: 'Issued on', type: 'date' },
      { key: 'expires_on', label: 'Expires on', type: 'date' },
    ],
  },
  {
    value: 'custom',
    label: 'Other',
    plural: 'Other',
    hint: 'Anything that doesn’t fit the other types',
    icon: Sparkles,
    dot: 'bg-indigo-500',
    chip: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
    group: 'personal',
    folder: 'other',
    dueLabel: 'Date',
    fields: [],
  },
]

/** Types shown as quick buttons in the form; the rest live under "More types". */
export const PRIMARY_CATEGORIES: ItemCategory[] = ['task', 'test', 'assignment', 'lab', 'project']

/** Types where a 0–100% progress bar makes sense. */
export const PROGRESS_CATEGORIES: ItemCategory[] = ['task', 'assignment', 'project', 'certification', 'aptitude', 'custom']

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c])) as Record<ItemCategory, CategoryConfig>

export const STATUSES: ReadonlyArray<{ value: ItemStatus; label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }> = [
  { value: 'todo', label: 'To do', tone: 'neutral' },
  { value: 'in_progress', label: 'In progress', tone: 'info' },
  { value: 'on_hold', label: 'On hold', tone: 'warning' },
  { value: 'completed', label: 'Completed', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'danger' },
]
export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.value, s])) as Record<ItemStatus, (typeof STATUSES)[number]>

export const PRIORITIES: ReadonlyArray<{ value: ItemPriority; label: string; rank: number; className: string }> = [
  { value: 'low', label: 'Low', rank: 0, className: 'text-muted-foreground' },
  { value: 'medium', label: 'Medium', rank: 1, className: 'text-sky-600 dark:text-sky-400' },
  { value: 'high', label: 'High', rank: 2, className: 'text-amber-600 dark:text-amber-400' },
  { value: 'urgent', label: 'Urgent', rank: 3, className: 'text-red-600 dark:text-red-400' },
]
export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map((p) => [p.value, p])) as Record<ItemPriority, (typeof PRIORITIES)[number]>

export const OPEN_STATUSES: ItemStatus[] = ['todo', 'in_progress', 'on_hold']

export function optionLabel(field: DetailField, value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  const match = field.options?.find((o) => o.value === value)
  return match?.label ?? String(value)
}
