import { z } from 'zod'
import { fromDateTimeInputs, toDateInput, toTimeInput } from '@/lib/dates'
import { isValidUrl, splitList } from '@/lib/utils'
import type { Item, ItemCategory, Json, TablesInsert } from '@/types/database'
import { CATEGORY_MAP, CATEGORIES, PRIORITIES, STATUSES } from './config'

const categoryValues = CATEGORIES.map((c) => c.value) as [ItemCategory, ...ItemCategory[]]

/** Form shape: everything the user types is a string; conversion happens in toItemPayload. */
export const itemFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Give it a title').max(200, 'Keep the title under 200 characters'),
    description: z.string().max(10_000, 'Description is too long'),
    category: z.enum(categoryValues),
    priority: z.enum(PRIORITIES.map((p) => p.value) as ['low', 'medium', 'high', 'urgent']),
    status: z.enum(STATUSES.map((s) => s.value) as ['todo', 'in_progress', 'on_hold', 'completed', 'cancelled']),
    start_date: z.string(),
    due_date: z.string(),
    due_time: z.string(),
    progress: z.number({ error: 'Enter a number' }).int().min(0).max(100),
    notes: z.string().max(20_000, 'Notes are too long'),
    tags: z.string().refine((v) => splitList(v).length <= 20, 'Up to 20 tags'),
    subject_id: z.string(),
    details: z.record(z.string(), z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.start_date && v.due_date && v.start_date > v.due_date) {
      ctx.addIssue({ code: 'custom', path: ['start_date'], message: 'Start must be on or before the end date' })
    }
    if (v.due_time && !v.due_date) {
      ctx.addIssue({ code: 'custom', path: ['due_date'], message: 'Pick a date for this time' })
    }
    for (const field of CATEGORY_MAP[v.category].fields) {
      const raw = v.details[field.key]?.trim()
      if (!raw) continue
      if (field.type === 'url' && !isValidUrl(raw)) {
        ctx.addIssue({ code: 'custom', path: ['details', field.key], message: 'Enter a full link starting with https://' })
      }
      if (field.type === 'number' && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
        ctx.addIssue({ code: 'custom', path: ['details', field.key], message: 'Enter a positive number' })
      }
      if (raw.length > 2000) {
        ctx.addIssue({ code: 'custom', path: ['details', field.key], message: 'Too long' })
      }
    }
  })

export type ItemFormValues = z.infer<typeof itemFormSchema>

export const emptyItemForm = (overrides: Partial<ItemFormValues> = {}): ItemFormValues => ({
  title: '',
  description: '',
  category: 'task',
  priority: 'medium',
  status: 'todo',
  start_date: '',
  due_date: '',
  due_time: '',
  progress: 0,
  notes: '',
  tags: '',
  subject_id: '',
  details: {},
  ...overrides,
})

/** Converts a detail object stored in jsonb back into editable strings. */
function detailsToForm(details: Json): Record<string, string> {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(details)) {
    if (v === null || v === undefined) continue
    out[k] = Array.isArray(v) ? v.join(', ') : String(v)
  }
  return out
}

export function itemToFormValues(item: Item): ItemFormValues {
  return {
    title: item.title,
    description: item.description ?? '',
    category: item.category,
    priority: item.priority,
    status: item.status,
    start_date: toDateInput(item.start_at),
    due_date: toDateInput(item.due_at),
    due_time: item.all_day ? '' : toTimeInput(item.due_at),
    progress: item.progress,
    notes: item.notes ?? '',
    tags: item.tags.join(', '),
    subject_id: item.subject_id ?? '',
    details: detailsToForm(item.details),
  }
}

/** Keeps only the fields defined for the category, typed per field definition. */
export function buildDetails(category: ItemCategory, raw: Record<string, string>): { [key: string]: Json } {
  const out: { [key: string]: Json } = {}
  for (const field of CATEGORY_MAP[category].fields) {
    const value = raw[field.key]?.trim()
    if (!value) continue
    if (field.type === 'number') out[field.key] = Number(value)
    else if (field.type === 'list') out[field.key] = splitList(value)
    else out[field.key] = value
  }
  return out
}

export function toItemPayload(values: ItemFormValues): TablesInsert<'items'> {
  const allDay = !values.due_time
  const completed = values.status === 'completed'
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    category: values.category,
    priority: values.priority,
    status: values.status,
    start_at: values.start_date ? fromDateTimeInputs(values.start_date) : null,
    due_at: values.due_date ? fromDateTimeInputs(values.due_date, values.due_time || null) : null,
    all_day: allDay,
    progress: completed ? 100 : values.progress,
    notes: values.notes.trim() || null,
    tags: splitList(values.tags).slice(0, 20),
    subject_id: values.subject_id || null,
    details: buildDetails(values.category, values.details),
  }
}

/** Typed read access to an item's jsonb details. */
export function detail(item: Pick<Item, 'details'>, key: string): string | undefined {
  const d = item.details
  if (!d || typeof d !== 'object' || Array.isArray(d)) return undefined
  const v = d[key]
  if (v === null || v === undefined) return undefined
  return Array.isArray(v) ? v.join(', ') : String(v)
}

export function detailNumber(item: Pick<Item, 'details'>, key: string): number | undefined {
  const v = detail(item, key)
  if (v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export function detailList(item: Pick<Item, 'details'>, key: string): string[] {
  const d = item.details
  if (!d || typeof d !== 'object' || Array.isArray(d)) return []
  const v = d[key]
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : splitList(typeof v === 'string' ? v : '')
}
