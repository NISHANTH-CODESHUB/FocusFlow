import { describe, expect, it } from 'vitest'
import type { Concept, Item } from '@/types/database'
import { buildAcademicTree, progressOf, revisionsDue } from '../academics/tree'
import { statusPatch } from '../items/api'
import { bucketize, filterItems, isOverdue, showsOnDay, upcoming } from '../items/selectors'
import { aptitudeStats, categoryBreakdown, completionSeries, dsaStats, internshipPipeline, streaks, summarize } from './compute'

const NOW = new Date(2026, 8, 27, 12, 0) // Sun 27 Sep 2026, noon local

let seq = 0
function item(overrides: Partial<Item> = {}): Item {
  seq++
  return {
    id: `item-${seq}`,
    user_id: 'u',
    title: `Item ${seq}`,
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
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

function concept(overrides: Partial<Concept> = {}): Concept {
  seq++
  return {
    id: `c-${seq}`,
    user_id: 'u',
    unit_id: 'unit-1',
    title: `Concept ${seq}`,
    status: 'not_started',
    notes: null,
    revision_date: null,
    resource_url: null,
    position: seq,
    completed_at: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

const at = (d: number, h = 10) => new Date(2026, 8, d, h).toISOString()

describe('overdue detection', () => {
  it('treats all-day items as due at end of day', () => {
    expect(isOverdue(item({ due_at: at(27, 0), all_day: true }), NOW)).toBe(false)
    expect(isOverdue(item({ due_at: at(26, 0), all_day: true }), NOW)).toBe(true)
  })
  it('uses the exact time for timed items and ignores completed ones', () => {
    expect(isOverdue(item({ due_at: at(27, 9) }), NOW)).toBe(true)
    expect(isOverdue(item({ due_at: at(27, 9), status: 'completed' }), NOW)).toBe(false)
  })
})

describe('summarize', () => {
  it('counts open, overdue, due today and completion rate (excluding cancelled)', () => {
    const s = summarize(
      [
        item({ due_at: at(20) }), // overdue
        item({ due_at: at(27, 18) }), // due today
        item({ status: 'completed', completed_at: at(25) }), // completed this week (week starts Mon 21)
        item({ status: 'cancelled' }),
        item({ status: 'in_progress', due_at: at(30) }),
      ],
      NOW,
    )
    expect(s).toMatchObject({ total: 5, open: 3, completed: 1, overdue: 1, dueToday: 1, inProgress: 1, completedThisWeek: 1, completionRate: 25 })
    expect(s.dueThisWeek).toBe(2)
  })
})

describe('bucketize', () => {
  it('groups by agenda bucket in display order', () => {
    const buckets = bucketize(
      [item({ due_at: at(30) }), item({ due_at: at(20) }), item({}), item({ due_at: at(28) }), item({ status: 'completed' })],
      NOW,
    )
    expect(buckets.map((b) => b.key)).toEqual(['overdue', 'tomorrow', 'later', 'someday', 'done'])
  })
})

describe('filterItems / upcoming', () => {
  const list = [
    item({ title: 'DBMS test', category: 'test', due_at: at(29) }),
    item({ title: 'Two sum', category: 'dsa', details: { topic: 'Arrays' }, due_at: at(28) }),
    item({ title: 'Old', status: 'completed' }),
  ]
  it('filters by search across details and by category', () => {
    expect(filterItems(list, { search: 'arrays' }).map((i) => i.title)).toEqual(['Two sum'])
    expect(filterItems(list, { categories: ['test'] })).toHaveLength(1)
    expect(filterItems(list, { showCompleted: false })).toHaveLength(2)
  })
  it('returns upcoming items sorted by due date', () => {
    expect(upcoming(list, 7, NOW).map((i) => i.title)).toEqual(['Two sum', 'DBMS test'])
    expect(upcoming(list, 7, NOW, ['test'])).toHaveLength(1)
  })
})

describe('calendar placement', () => {
  it('fills short spans but only marks start and due days of long ones', () => {
    const hackathon = item({ start_at: at(10), due_at: at(12) })
    const project = item({ start_at: at(1), due_at: at(30) })
    expect(showsOnDay(hackathon, new Date(2026, 8, 11))).toBe(true)
    expect(showsOnDay(project, new Date(2026, 8, 15))).toBe(false)
    expect(showsOnDay(project, new Date(2026, 8, 1))).toBe(true)
    expect(showsOnDay(project, new Date(2026, 8, 30))).toBe(true)
    expect(showsOnDay(item({}), new Date(2026, 8, 1))).toBe(false)
  })
})

describe('statusPatch', () => {
  it('resets progress when reopening a finished item and leaves partial progress alone', () => {
    expect(statusPatch({ status: 'completed', progress: 100 }, 'todo')).toEqual({ status: 'todo', progress: 0 })
    expect(statusPatch({ status: 'in_progress', progress: 60 }, 'on_hold')).toEqual({ status: 'on_hold' })
    expect(statusPatch({ status: 'todo', progress: 0 }, 'completed')).toEqual({ status: 'completed' })
  })
})

describe('completionSeries', () => {
  it('buckets completions per day across items and concepts', () => {
    const series = completionSeries(
      [item({ status: 'completed', completed_at: at(27) }), item({ status: 'completed', completed_at: at(25) }), item({ completed_at: at(27) })],
      [concept({ status: 'completed', completed_at: at(27) })],
      '7d',
      NOW,
    )
    expect(series).toHaveLength(7)
    expect(series.at(-1)).toMatchObject({ tasks: 1, concepts: 1 })
    expect(series.at(-3)).toMatchObject({ tasks: 1, concepts: 0 })
  })
  it('produces 12 monthly buckets', () => {
    expect(completionSeries([], [], '12m', NOW)).toHaveLength(12)
  })
})

describe('streaks', () => {
  it('computes current and best streaks', () => {
    const done = (d: number) => item({ status: 'completed', completed_at: at(d) })
    const r = streaks([done(10), done(11), done(12), done(13), done(26), done(27)], [], NOW)
    expect(r).toEqual({ current: 2, best: 4 })
  })
  it('keeps a streak alive until the end of the next day', () => {
    const r = streaks([item({ status: 'completed', completed_at: at(26) })], [], NOW)
    expect(r.current).toBe(1)
  })
})

describe('career stats', () => {
  const list = [
    item({ category: 'dsa', status: 'completed', details: { difficulty: 'easy', topic: 'Arrays', platform: 'leetcode' } }),
    item({ category: 'dsa', details: { difficulty: 'hard', topic: 'Graphs' } }),
    item({ category: 'aptitude', status: 'completed', details: { section: 'quantitative', score: 30, total: 40 } }),
    item({ category: 'aptitude', details: { section: 'verbal', score: 45, total: 50 } }),
    item({ category: 'internship', details: { stage: 'interview' } }),
    item({ category: 'internship' }),
  ]
  it('summarises DSA by difficulty and topic', () => {
    const s = dsaStats(list)
    expect(s).toMatchObject({ total: 2, solved: 1, percent: 50 })
    expect(s.byDifficulty.find((b) => b.key === 'easy')).toMatchObject({ total: 1, done: 1 })
    expect(s.byTopic.map((t) => t.key)).toEqual(expect.arrayContaining(['Arrays', 'Graphs']))
    expect(s.byPlatform).toEqual([
      expect.objectContaining({ key: 'leetcode', label: 'LeetCode', total: 1 }),
      expect.objectContaining({ key: '_none', label: 'Unspecified', total: 1 }),
    ])
  })
  it('averages aptitude mock scores', () => {
    expect(aptitudeStats(list)).toMatchObject({ total: 2, done: 1, mocks: 2, averageScore: 83 })
  })
  it('builds the internship pipeline with wishlist as the default stage', () => {
    const p = internshipPipeline(list)
    expect(p.find((s) => s.stage === 'wishlist')?.count).toBe(1)
    expect(p.find((s) => s.stage === 'interview')?.count).toBe(1)
  })
  it('breaks down by category', () => {
    expect(categoryBreakdown(list).map((c) => c.category)).toEqual(['internship', 'dsa', 'aptitude'])
  })
})

describe('academic tree', () => {
  it('rolls concept progress up to units and subjects', () => {
    const base = { user_id: 'u', created_at: '2026-01-01', updated_at: '2026-01-01' }
    const tree = buildAcademicTree({
      subjects: [{ ...base, id: 's1', name: 'OS', code: null, semester: null, instructor: null, credits: null, color: 'sky', description: null, archived: false, position: 0 }],
      units: [
        { ...base, id: 'u1', subject_id: 's1', title: 'Unit 1', description: null, position: 0 },
        { ...base, id: 'u2', subject_id: 's1', title: 'Unit 2', description: null, position: 1 },
      ],
      concepts: [
        concept({ unit_id: 'u1', status: 'completed' }),
        concept({ unit_id: 'u1', status: 'learning' }),
        concept({ unit_id: 'u2', status: 'not_started' }),
        concept({ unit_id: 'u2', status: 'completed' }),
      ],
    })
    // Only completed topics count toward the percentage.
    expect(tree[0]!.units.map((u) => u.stats.percent)).toEqual([50, 50])
    expect(tree[0]!.stats).toMatchObject({ total: 4, completed: 2, learning: 1, notStarted: 1, percent: 50 })
  })
  it('handles empty input', () => {
    expect(progressOf([])).toMatchObject({ total: 0, percent: 0 })
  })
  it('lists revisions due today or earlier', () => {
    const due = revisionsDue([concept({ revision_date: '2026-09-27' }), concept({ revision_date: '2026-09-28' }), concept({ revision_date: '2026-09-01' })], NOW)
    expect(due.map((c) => c.revision_date)).toEqual(['2026-09-01', '2026-09-27'])
  })
})
