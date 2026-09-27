import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import type { Dataset } from './datasets'
import { buildWorkbook } from './excel'
import { buildPdf, pdfSafe } from './pdf'

const datasets: Dataset[] = [
  {
    key: 'summary',
    title: 'Summary',
    columns: [
      { key: 'metric', header: 'Metric', width: 30 },
      { key: 'value', header: 'Value', width: 12 },
    ],
    rows: [
      { metric: 'Planner items', value: 34 },
      { metric: 'Completion rate', value: '52%' },
    ],
  },
  {
    key: 'tasks',
    title: 'Planner items',
    columns: [
      { key: 'title', header: 'Title', width: 40 },
      { key: 'status', header: 'Status', width: 12 },
      { key: 'due', header: 'Due', width: 14 },
    ],
    rows: Array.from({ length: 60 }, (_, i) => ({ title: `Item ${i + 1} — a fairly long title that should wrap nicely`, status: i % 3 ? 'To do' : 'Completed', due: '05 Oct 2026' })),
  },
  { key: 'achievements', title: 'Achievements', columns: [{ key: 'title', header: 'Achievement' }], rows: [] },
]

const blobBytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer())

describe('pdfSafe', () => {
  it('keeps Latin-1 and typographic characters, transliterates symbols', () => {
    expect(pdfSafe('Café — “quotes” • 50%')).toBe('Café — “quotes” • 50%')
    expect(pdfSafe('Big-O, Θ, Ω')).toBe('Big-O, Theta, Omega')
    expect(pdfSafe('a → b ≤ c ₹500')).toBe('a -> b <= c Rs.500')
    expect(pdfSafe('Łódź 漢')).toBe('?ódz ?')
  })
})

describe('report rendering', () => {
  it('produces a multi-page PDF', async () => {
    const pdf = buildPdf(datasets, { name: 'Test Student', email: 'student@example.test', now: new Date(2026, 8, 27) })
    const bytes = await blobBytes(pdf)
    const text = new TextDecoder('latin1').decode(bytes)
    expect(text.startsWith('%PDF')).toBe(true)
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1)
    if (process.env.EXPORT_PREVIEW_DIR) writeFileSync(join(process.env.EXPORT_PREVIEW_DIR, 'preview.pdf'), bytes)
  })

  it('produces a workbook with one styled sheet per dataset', async () => {
    const blob = await buildWorkbook(datasets, { name: 'Test Student' })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load((await blob.arrayBuffer()) as ArrayBuffer)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Summary', 'Planner items', 'Achievements'])
    const sheet = wb.getWorksheet('Planner items')!
    expect(sheet.rowCount).toBe(61)
    expect(sheet.getRow(1).font?.bold).toBe(true)
    expect(sheet.getCell('A2').value).toContain('Item 1')
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
  })
})
