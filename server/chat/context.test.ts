import { describe, expect, it } from 'vitest'
import type { Concept, Item, Subject, Unit } from '../../src/types/database'
import { buildStudentContext, MAX_CONTEXT_CHARS, safeTimeZone } from './context'

const base = { user_id: 'u', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }
let n = 0
const item = (o: Partial<Item>): Item => ({
  ...base,
  id: `i${++n}`,
  title: `Item ${n}`,
  description: null,
  category: 'task',
  priority: 'medium',
  status: 'todo',
  start_at: null,
  due_at: null,
  all_day: false,
  progress: 0,
  notes: null,
  tags: [],
  details: {},
  subject_id: null,
  completed_at: null,
  ...o,
})

// Tue 29 Sep 2026, 13:30 UTC = 19:00 in Asia/Kolkata
const NOW = new Date('2026-09-29T13:30:00Z')
const subject: Subject = { ...base, id: 's1', name: 'Database Systems', code: 'CS302', semester: 'Sem 5', instructor: null, credits: 4, color: 'sky', description: null, archived: false, position: 0 }
const unit: Unit = { ...base, id: 'un1', subject_id: 's1', title: 'Unit 2: Normalization', description: null, position: 0 }
const concept = (title: string, status: Concept['status'], revision_date: string | null = null): Concept => ({
  ...base, id: `c${++n}`, unit_id: 'un1', title, status, notes: null, revision_date, resource_url: null, position: n, completed_at: null,
})

describe('buildStudentContext', () => {
  const text = buildStudentContext(
    {
      profile: { full_name: 'Rahul Kumar', institution: 'SIT', program: 'B.Tech CSE', graduation_year: 2027 },
      items: [
        item({ title: 'DAA assignment 3', category: 'assignment', due_at: '2026-09-26T18:30:00Z', all_day: true, priority: 'high', progress: 60, status: 'in_progress' }),
        item({ title: 'CN lab', category: 'lab', due_at: '2026-09-29T08:30:00Z', subject_id: 's1' }), // 2:00 PM IST today
        item({ title: 'DBMS unit test', category: 'test', due_at: '2026-10-01T03:30:00Z', details: { syllabus: 'Units 2-3', venue_url: 'https://x' } }),
        item({ title: 'Portfolio', category: 'project', due_at: '2026-12-01T00:00:00Z' }),
        item({ title: 'Word Ladder', category: 'dsa', details: { difficulty: 'hard', topic: 'Graphs' } }),
        item({ title: 'Two Sum', category: 'dsa', status: 'completed', completed_at: '2026-09-28T10:00:00Z' }),
        item({ title: 'Cancelled thing', status: 'cancelled', due_at: '2026-09-29T08:30:00Z' }),
      ],
      subjects: [subject],
      units: [unit],
      concepts: [concept('Functional dependencies', 'completed'), concept('BCNF', 'not_started'), concept('1NF, 2NF, 3NF', 'learning', '2026-09-28')],
      skills: [{ ...base, id: 'k1', name: 'React', area: 'Frontend', level: 'intermediate', progress: 65, target_date: null, notes: null }],
    },
    { now: NOW, timeZone: 'Asia/Kolkata' },
  )

  it('shows the student and local time', () => {
    expect(text).toContain('Student: Rahul Kumar · B.Tech CSE · SIT · graduating 2027')
    expect(text).toContain('Tuesday, 29 September 2026, 7:00 PM (Asia/Kolkata)')
  })

  it('groups open work by urgency in the student’s time zone', () => {
    const section = (name: string) => text.split(`${name} (`)[1]?.split('\n\n')[0] ?? ''
    expect(section('OVERDUE')).toContain('DAA assignment 3 · due Sun 27 Sept · high priority · in progress · 60% done')
    expect(section('DUE TODAY')).toContain('[Lab] CN lab · due Tue 29 Sept 2:00 PM · CS302')
    expect(section('NEXT 14 DAYS')).toContain('[Test] DBMS unit test · due Thu 1 Oct 9:00 AM · syllabus: Units 2-3')
    expect(section('LATER')).toContain('Portfolio')
    expect(section('NO DATE SET')).toContain('[DSA] Word Ladder · difficulty: hard, topic: Graphs')
    expect(section('FINISHED IN THE LAST 7 DAYS')).toContain('Two Sum')
  })

  it('leaves out cancelled items and link fields', () => {
    expect(text).not.toContain('Cancelled thing')
    expect(text).not.toContain('https://x')
  })

  it('summarises subjects, topics, revisions and skills', () => {
    expect(text).toContain('- CS302 Database Systems: 1/3 topics done · Sem 5')
    expect(text).toContain('Unit 2: Normalization — done: Functional dependencies | studying: 1NF, 2NF, 3NF | not started: BCNF')
    expect(text).toContain('REVISIONS DUE (1):\n- 1NF, 2NF, 3NF (planned Mon 28 Sept)')
    expect(text).toContain('React (intermediate, 65%)')
  })

  it('handles an empty account and caps very large ones', () => {
    const empty = buildStudentContext({ profile: null, items: [], subjects: [], units: [], concepts: [], skills: [] }, { now: NOW, timeZone: 'UTC' })
    expect(empty).toContain('Planner: empty')
    expect(empty).toContain('Subjects: none added yet.')

    const many = Array.from({ length: 400 }, (_, i) => item({ title: `Task number ${i} with a fairly long descriptive title`, due_at: '2026-10-02T10:00:00Z' }))
    const big = buildStudentContext({ profile: null, items: many, subjects: [], units: [], concepts: [], skills: [] }, { now: NOW, timeZone: 'UTC' })
    expect(big.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS + 80)
    expect(big).toContain('NEXT 14 DAYS (400, showing 30)')
  })

  it('rejects unknown time zones', () => {
    expect(safeTimeZone('Mars/Olympus')).toBe('UTC')
    expect(safeTimeZone(42)).toBe('UTC')
    expect(safeTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata')
  })
})
