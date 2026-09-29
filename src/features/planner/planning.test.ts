import { describe, expect, it } from 'vitest'
import type { Item } from '@/types/database'
import { itemsOnDay, rescheduleTo, todayPlan } from './planning'

const NOW = new Date(2026, 8, 29, 12, 0) // Tue 29 Sep 2026, noon
let seq = 0
const item = (o: Partial<Item> = {}): Item => ({
  id: `i${++seq}`,
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
  ...o,
})
const at = (d: number, h = 0, m = 0) => new Date(2026, 8, d, h, m).toISOString()

describe('rescheduleTo', () => {
  it('keeps the time of day for timed items', () => {
    const patch = rescheduleTo(item({ due_at: at(29, 14, 30) }), new Date(2026, 9, 2))
    expect(new Date(patch.due_at!)).toEqual(new Date(2026, 9, 2, 14, 30))
    expect(patch).not.toHaveProperty('start_at')
  })
  it('shifts multi-day spans by the same number of days', () => {
    const patch = rescheduleTo(item({ start_at: at(29), due_at: at(30), all_day: true }), new Date(2026, 9, 5))
    expect(new Date(patch.start_at!)).toEqual(new Date(2026, 9, 4))
    expect(new Date(patch.due_at!)).toEqual(new Date(2026, 9, 5))
  })
  it('schedules undated items as all-day and ignores same-day drops', () => {
    expect(rescheduleTo(item(), new Date(2026, 9, 1, 18))).toEqual({ due_at: new Date(2026, 9, 1).toISOString(), all_day: true })
    expect(rescheduleTo(item({ due_at: at(29, 9) }), new Date(2026, 8, 29, 23))).toEqual({})
  })
})

describe('todayPlan', () => {
  it('splits today into overdue, scheduled, anytime and done', () => {
    const plan = todayPlan(
      [
        item({ title: 'late', due_at: at(27), all_day: true }),
        item({ title: 'late timed', due_at: at(29, 9) }),
        item({ title: 'lab 2pm', due_at: at(29, 14) }),
        item({ title: 'lecture 11am', due_at: at(29, 11) }),
        item({ title: 'anytime', due_at: at(29), all_day: true }),
        item({ title: 'hackathon', start_at: at(28), due_at: at(30), all_day: true }),
        item({ title: 'tomorrow', due_at: at(30, 10) }),
        item({ title: 'done', status: 'completed', completed_at: at(29, 8) }),
        item({ title: 'done yesterday', status: 'completed', completed_at: at(28, 8) }),
        item({ title: 'cancelled', status: 'cancelled', due_at: at(29, 10) }),
      ],
      NOW,
    )
    expect(plan.overdue.map((i) => i.title)).toEqual(['late'])
    expect(plan.scheduled.map((i) => i.title)).toEqual(['late timed', 'lecture 11am', 'lab 2pm'])
    expect(plan.anytime.map((i) => i.title).sort()).toEqual(['anytime', 'hackathon'])
    expect(plan.doneToday.map((i) => i.title)).toEqual(['done'])
    expect(plan.remaining).toBe(6)
    expect(plan.percent).toBe(14)
  })
  it('treats a timed item later today as scheduled, not overdue', () => {
    const plan = todayPlan([item({ due_at: at(29, 18) })], NOW)
    expect(plan.scheduled).toHaveLength(1)
    expect(plan.overdue).toHaveLength(0)
  })
  it('is empty-safe', () => {
    expect(todayPlan([], NOW)).toMatchObject({ remaining: 0, percent: 0 })
  })
})

describe('itemsOnDay', () => {
  it('lists open items first, timed before all-day, and skips cancelled', () => {
    const day = new Date(2026, 9, 1)
    const list = itemsOnDay(
      [
        item({ title: 'all-day', due_at: at(31), all_day: true }), // 31 Sep → 1 Oct
        item({ title: 'done', due_at: new Date(2026, 9, 1, 8).toISOString(), status: 'completed' }),
        item({ title: 'timed', due_at: new Date(2026, 9, 1, 15).toISOString() }),
        item({ title: 'cancelled', due_at: new Date(2026, 9, 1, 9).toISOString(), status: 'cancelled' }),
      ],
      day,
    )
    expect(list.map((i) => i.title)).toEqual(['timed', 'all-day', 'done'])
  })
})
