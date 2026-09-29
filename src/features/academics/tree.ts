import { startOfDay } from 'date-fns'
import { parseLocalDate } from '@/lib/dates'
import { percent } from '@/lib/utils'
import type { Concept, ConceptStatus, Subject, Unit } from '@/types/database'

export interface ProgressStats {
  total: number
  completed: number
  learning: number
  notStarted: number
  percent: number
}

export interface UnitNode extends Unit {
  concepts: Concept[]
  stats: ProgressStats
}

export interface SubjectNode extends Subject {
  units: UnitNode[]
  stats: ProgressStats
}

export function progressOf(concepts: ReadonlyArray<Pick<Concept, 'status'>>): ProgressStats {
  let completed = 0
  let learning = 0
  for (const c of concepts) {
    if (c.status === 'completed') completed++
    else if (c.status === 'learning') learning++
  }
  const total = concepts.length
  // Only finished topics count — "25% done" with nothing finished confused people.
  return { total, completed, learning, notStarted: total - completed - learning, percent: percent(completed, total) }
}

export function buildAcademicTree(data: { subjects: Subject[]; units: Unit[]; concepts: Concept[] }): SubjectNode[] {
  const conceptsByUnit = new Map<string, Concept[]>()
  for (const c of data.concepts) {
    const list = conceptsByUnit.get(c.unit_id) ?? []
    list.push(c)
    conceptsByUnit.set(c.unit_id, list)
  }
  const unitsBySubject = new Map<string, UnitNode[]>()
  for (const u of data.units) {
    const concepts = (conceptsByUnit.get(u.id) ?? []).sort(byPosition)
    const node: UnitNode = { ...u, concepts, stats: progressOf(concepts) }
    const list = unitsBySubject.get(u.subject_id) ?? []
    list.push(node)
    unitsBySubject.set(u.subject_id, list)
  }
  return data.subjects
    .map((s) => {
      const units = (unitsBySubject.get(s.id) ?? []).sort(byPosition)
      return { ...s, units, stats: progressOf(units.flatMap((u) => u.concepts)) }
    })
    .sort(byPosition)
}

function byPosition(a: { position: number; created_at: string }, b: { position: number; created_at: string }) {
  return a.position - b.position || a.created_at.localeCompare(b.created_at)
}

export const CONCEPT_STATUSES: ReadonlyArray<{ value: ConceptStatus; label: string; tone: 'neutral' | 'info' | 'success' }> = [
  { value: 'not_started', label: 'Not started', tone: 'neutral' },
  { value: 'learning', label: 'Learning', tone: 'info' },
  { value: 'completed', label: 'Completed', tone: 'success' },
]

/** Concepts whose revision date is today or already passed. */
export function revisionsDue(concepts: readonly Concept[], now = new Date()): Concept[] {
  const today = startOfDay(now)
  return concepts
    .filter((c) => {
      const d = parseLocalDate(c.revision_date)
      return d && d <= today
    })
    .sort((a, b) => (a.revision_date ?? '').localeCompare(b.revision_date ?? ''))
}

export const SUBJECT_COLORS: ReadonlyArray<{ value: string; hex: string; swatch: string; soft: string; text: string }> = [
  { value: 'indigo', hex: '#6366f1', swatch: 'bg-indigo-500', soft: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400' },
  { value: 'sky', hex: '#0ea5e9', swatch: 'bg-sky-500', soft: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400' },
  { value: 'emerald', hex: '#10b981', swatch: 'bg-emerald-500', soft: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'amber', hex: '#f59e0b', swatch: 'bg-amber-500', soft: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  { value: 'rose', hex: '#f43f5e', swatch: 'bg-rose-500', soft: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400' },
  { value: 'violet', hex: '#8b5cf6', swatch: 'bg-violet-500', soft: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400' },
  { value: 'teal', hex: '#14b8a6', swatch: 'bg-teal-500', soft: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400' },
  { value: 'orange', hex: '#f97316', swatch: 'bg-orange-500', soft: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400' },
  { value: 'slate', hex: '#64748b', swatch: 'bg-slate-500', soft: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-300' },
]

export const subjectColor = (value: string) => SUBJECT_COLORS.find((c) => c.value === value) ?? SUBJECT_COLORS[0]!
