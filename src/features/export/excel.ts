import ExcelJS from 'exceljs'
import type { Dataset } from './datasets'

/** One worksheet per dataset with a styled, frozen, filterable header row. */
export async function buildWorkbook(datasets: Dataset[], meta: { name: string; now?: Date }): Promise<Blob> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'StudentOS'
  wb.created = meta.now ?? new Date()
  wb.title = `StudentOS report — ${meta.name}`
  const used = new Set<string>()

  for (const ds of datasets) {
    const ws = wb.addWorksheet(sheetName(ds.title, used), { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = ds.columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(c.width ?? 14, c.header.length + 2) }))
    ws.addRows(ds.rows)

    const header = ws.getRow(1)
    header.font = { bold: true, color: { argb: 'FF3730A3' } }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF0FF' } }
    header.alignment = { vertical: 'middle' }
    header.height = 20
    ws.eachRow((row, i) => {
      if (i > 1) row.alignment = { vertical: 'top', wrapText: true }
    })
    if (ds.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ds.columns.length } }
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** Excel sheet names: ≤31 chars, no []:*?/\ and unique. */
export function sheetName(title: string, used: Set<string>): string {
  const base =
    title
      .replace(/[[\]:*?/\\]/g, '-')
      .slice(0, 31)
      .replace(/[\s-]+$/, '') || 'Sheet'
  let name = base
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 28)} ${n}`
  used.add(name.toLowerCase())
  return name
}
