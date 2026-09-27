import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input } from '@/components/ui/input'
import { Card, CardBody, CardHeader, ErrorState, ListSkeleton } from '@/components/ui/misc'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/auth'
import { useAcademics } from '../academics/api'
import { useAchievements, useSkills } from '../career/api'
import { useItems } from '../items/api'
import { useDisplayName } from '../settings/api'
import { buildDatasets, exportFileName, SECTIONS, triggerDownload, type ExportOptions, type SectionKey } from './datasets'

const PRESETS: Array<{ label: string; sections: SectionKey[] }> = [
  { label: 'Everything', sections: SECTIONS.map((s) => s.key) },
  { label: 'Academic report', sections: ['summary', 'academics', 'study_plan', 'tasks'] },
  { label: 'Placement portfolio', sections: ['summary', 'projects', 'certifications', 'dsa', 'aptitude', 'internships', 'events', 'skills', 'achievements'] },
]

export default function ExportPage() {
  const items = useItems()
  const academics = useAcademics()
  const skills = useSkills()
  const achievements = useAchievements()
  const { user } = useAuth()
  const name = useDisplayName()
  const [sections, setSections] = useState<SectionKey[]>(PRESETS[0]!.sections)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [includeCompleted, setIncludeCompleted] = useState(true)
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null)

  const loading = items.isLoading || academics.isLoading || skills.isLoading || achievements.isLoading
  const error = items.error || academics.error || skills.error || achievements.error

  const datasets = useMemo(() => {
    if (loading || error) return []
    const options: ExportOptions = { sections: SECTIONS.map((s) => s.key).filter((k) => sections.includes(k)), from: from || undefined, to: to || undefined, includeCompleted }
    return buildDatasets(
            {
              items: items.data ?? [],
              subjects: academics.data?.subjects ?? [],
              units: academics.data?.units ?? [],
              concepts: academics.data?.concepts ?? [],
              skills: skills.data ?? [],
              achievements: achievements.data ?? [],
            },
      options,
    )
  }, [loading, error, items.data, academics.data, skills.data, achievements.data, sections, from, to, includeCompleted])
  const rowCount = (key: SectionKey) => datasets.filter((d) => d.key === key).reduce((s, d) => s + d.rows.length, 0)
  const rangeInvalid = !!from && !!to && from > to

  const run = async (format: 'pdf' | 'xlsx') => {
    if (!datasets.length) return toast.error('Pick at least one section to export')
    setBusy(format)
    try {
      if (format === 'pdf') {
        const { buildPdf } = await import('./pdf')
        triggerDownload(buildPdf(datasets, { name, email: user?.email }), exportFileName('pdf'))
      } else {
        const { buildWorkbook } = await import('./excel')
        triggerDownload(await buildWorkbook(datasets, { name }), exportFileName('xlsx'))
      }
      toast.success(`${format === 'pdf' ? 'PDF' : 'Excel'} report downloaded`)
    } catch (e) {
      toast.error(`Export failed: ${errorMessage(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const toggle = (k: SectionKey) => setSections((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))

  return (
    <div>
      <PageHeader title="Export" description="Download your data as a formatted PDF report or an Excel workbook (one sheet per section)." />
      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader
              title="What to include"
              description={`${sections.length} of ${SECTIONS.length} sections selected`}
              action={
                <div className="flex flex-wrap gap-1">
                  {PRESETS.map((p) => (
                    <Button key={p.label} variant="ghost" size="sm" onClick={() => setSections(p.sections)}>
                      {p.label}
                    </Button>
                  ))}
                </div>
              }
            />
            <CardBody>
              <div className="grid gap-2 sm:grid-cols-2">
                {SECTIONS.map((s) => {
                  const checked = sections.includes(s.key)
                  return (
                    <label
                      key={s.key}
                      className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors', checked ? 'border-primary/40 bg-primary-soft/50' : 'border-border hover:bg-accent')}
                    >
                      <Checkbox checked={checked} onChange={() => toggle(s.key)} className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 text-sm font-medium">
                          {s.label}
                          {checked && <span className="text-xs font-normal text-muted-foreground tabular-nums">{rowCount(s.key)} rows</span>}
                        </span>
                        <span className="block text-xs text-muted-foreground">{s.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Planner filters" description="Applies to planner-based sections" />
              <CardBody className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From" htmlFor="ex-from">
                    <Input id="ex-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </Field>
                  <Field label="To" htmlFor="ex-to" error={rangeInvalid ? 'Must be after start' : undefined}>
                    <Input id="ex-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={rangeInvalid} />
                  </Field>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} />
                  Include completed & cancelled items
                </label>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-2 pt-4">
                <Button className="w-full" size="lg" onClick={() => run('pdf')} disabled={!!busy || rangeInvalid || !sections.length}>
                  {busy === 'pdf' ? <Loader2 className="animate-spin" /> : <FileText />} Download PDF
                </Button>
                <Button className="w-full" size="lg" variant="outline" onClick={() => run('xlsx')} disabled={!!busy || rangeInvalid || !sections.length}>
                  {busy === 'xlsx' ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Download Excel
                </Button>
                <p className="pt-1 text-center text-xs text-muted-foreground">Generated in your browser — your data never leaves your account.</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
