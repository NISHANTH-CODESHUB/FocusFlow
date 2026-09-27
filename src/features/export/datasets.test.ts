import { describe, expect, it } from 'vitest'
import type { Item } from '@/types/database'
import { buildDatasets, SECTIONS, type ExportSource } from './datasets'
import { sheetName } from './excel'

const base = { user_id: 'u', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }
const item = (o: Partial<Item>): Item => ({
  ...base,
  id: Math.random().toString(36),
  title: 'x',
  description: null,
  category: 'task',
  priority: 'medium',
  status: 'todo',
  start_at: null,
  due_at: null,
  all_day: true,
  progress: 0,
  notes: null,
  tags: [],
  details: {},
  subject_id: null,
  completed_at: null,
  ...o,
})

const src: ExportSource = {
  items: [
    item({ title: 'OS lab', category: 'lab', due_at: new Date(2026, 9, 5).toISOString(), subject_id: 's1' }),
    item({ title: 'Two sum', category: 'dsa', status: 'completed', completed_at: '2026-09-20T10:00:00Z', details: { difficulty: 'easy', platform: 'leetcode', topic: 'Arrays' } }),
    item({ title: 'Old task', due_at: new Date(2026, 5, 1).toISOString() }),
    item({ title: 'AWS CCP', category: 'certification', details: { issuer: 'AWS', issued_on: '2026-08-01' } }),
  ],
  subjects: [{ ...base, id: 's1', name: 'Operating Systems', code: 'CS301', semester: 'Sem 5', instructor: null, credits: 4, color: 'sky', description: null, archived: false, position: 0 }],
  units: [{ ...base, id: 'u1', subject_id: 's1', title: 'Processes', description: null, position: 0 }],
  concepts: [{ ...base, id: 'c1', unit_id: 'u1', title: 'Scheduling', status: 'learning', notes: 'FCFS\nSJF', revision_date: '2026-10-01', resource_url: null, position: 0, completed_at: null }],
  skills: [{ ...base, id: 'k1', name: 'React', area: 'Frontend', level: 'intermediate', progress: 60, target_date: null, notes: null }],
  achievements: [],
}

const NOW = new Date(2026, 8, 27)

describe('buildDatasets', () => {
  it('builds every section in the requested order', () => {
    const all = buildDatasets(src, { sections: SECTIONS.map((s) => s.key), includeCompleted: true }, NOW)
    // productivity yields two tables
    expect(all.map((d) => d.key)).toEqual([...SECTIONS.map((s) => s.key), 'productivity'])
    for (const ds of all) for (const row of ds.rows) for (const col of ds.columns) expect(row).toHaveProperty(col.key)
  })

  it('filters planner items by date range and completion', () => {
    const [tasks] = buildDatasets(src, { sections: ['tasks'], from: '2026-09-01', to: '2026-12-31', includeCompleted: false }, NOW)
    expect(tasks!.rows.map((r) => r.title)).toEqual(['OS lab', 'AWS CCP'])
    expect(tasks!.rows[0]).toMatchObject({ category: 'Lab', subject: 'CS301 Operating Systems', due: '05 Oct 2026' })
  })

  it('maps option values to labels and flattens notes', () => {
    const [dsa, plan] = buildDatasets(src, { sections: ['dsa', 'study_plan'], includeCompleted: true }, NOW)
    expect(dsa!.rows[0]).toMatchObject({ difficulty: 'Easy', platform: 'LeetCode', status: 'Completed' })
    expect(plan!.rows[0]).toMatchObject({ subject: 'CS301', unit: 'Processes', status: 'Learning', notes: 'FCFS SJF' })
  })

  it('computes academic percentages', () => {
    const [academics] = buildDatasets(src, { sections: ['academics'], includeCompleted: true }, NOW)
    expect(academics!.rows[0]).toMatchObject({ concepts: 1, learning: 1, percent: 50 })
  })
})

describe('sheetName', () => {
  it('sanitizes, truncates and de-duplicates', () => {
    const used = new Set<string>()
    expect(sheetName('Productivity — last 12 months [x]', used)).toBe('Productivity — last 12 months')
    expect(sheetName('A/B', used)).toBe('A-B')
    expect(sheetName('A/B', used)).toBe('A-B 2')
  })
})
