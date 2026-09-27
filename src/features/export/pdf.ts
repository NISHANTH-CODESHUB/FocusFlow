import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { formatDate } from '@/lib/dates'
import type { Dataset } from './datasets'

/* jsPDF's standard fonts only cover WinAnsi (Latin-1 plus a few typographic
 * characters). Transliterate common academic symbols and replace the rest so
 * the report never shows mojibake. The Excel export keeps full Unicode. */
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')
const GREEK: Record<string, string> = {
  α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', θ: 'theta', λ: 'lambda', μ: 'mu', π: 'pi', σ: 'sigma', φ: 'phi', ω: 'omega',
  Γ: 'Gamma', Δ: 'Delta', Θ: 'Theta', Λ: 'Lambda', Π: 'Pi', Σ: 'Sigma', Φ: 'Phi', Ω: 'Omega',
}
const SYMBOLS: Record<string, string> = { '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~', '∞': 'inf', '√': 'sqrt', '₹': 'Rs.', '✓': 'v', '✔': 'v', '×': 'x' }

export function pdfSafe(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0)!
    if (code < 256 || WIN_ANSI_EXTRA.has(ch)) out += ch
    else if (GREEK[ch]) out += GREEK[ch]
    else if (SYMBOLS[ch]) out += SYMBOLS[ch]
    else {
      // Strip accents where possible (e.g. "ő" -> "o"), otherwise mark as unsupported.
      const base = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '')
      out += base && [...base].every((c) => c.codePointAt(0)! < 256) ? base : '?'
    }
  }
  return out
}

const INDIGO: [number, number, number] = [79, 70, 229]
const INK: [number, number, number] = [17, 24, 39]
const MUTED: [number, number, number] = [107, 114, 128]

/** Renders datasets as a paginated landscape A4 report. */
export function buildPdf(datasets: Dataset[], meta: { name: string; email?: string; now?: Date }): Blob {
  const now = meta.now ?? new Date()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  const margin = 40

  // Header band
  doc.setFillColor(...INDIGO)
  doc.rect(0, 0, width, 70, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('FocusFlow report', margin, 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(pdfSafe(`${meta.name}${meta.email ? ` · ${meta.email}` : ''}`), width - margin, 36, { align: 'right' })
  doc.text(`Generated ${formatDate(now, 'd MMM yyyy, h:mm a')}`, width - margin, 50, { align: 'right' })

  let y = 100
  for (const ds of datasets) {
    const pageHeight = doc.internal.pageSize.getHeight()
    if (y > pageHeight - 120) {
      doc.addPage()
      y = margin + 10
    }
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(pdfSafe(ds.title), margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(`${ds.rows.length} ${ds.rows.length === 1 ? 'row' : 'rows'}`, margin, y + 13)

    if (ds.rows.length === 0) {
      doc.text('No data for this section.', margin, y + 32)
      y += 56
      continue
    }

    const totalWidth = ds.columns.reduce((s, c) => s + (c.width ?? 15), 0)
    autoTable(doc, {
      startY: y + 22,
      margin: { left: margin, right: margin },
      head: [ds.columns.map((c) => pdfSafe(c.header))],
      body: ds.rows.map((r) => ds.columns.map((c) => pdfSafe(String(r[c.key] ?? '')))),
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: INK, overflow: 'linebreak', lineColor: [229, 231, 235], lineWidth: 0.5 },
      headStyles: { fillColor: [238, 240, 255], textColor: INDIGO, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: Object.fromEntries(ds.columns.map((c, i) => [i, { cellWidth: ((c.width ?? 15) / totalWidth) * (width - margin * 2) }])),
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 34
  }

  // Footer with page numbers
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    const h = doc.internal.pageSize.getHeight()
    doc.text('FocusFlow', margin, h - 20)
    doc.text(`Page ${i} of ${pages}`, width - margin, h - 20, { align: 'right' })
  }
  return doc.output('blob')
}
