import { ArrowLeft, CalendarClock, Check, ChevronDown, Circle, CircleDot, ExternalLink, FileText, Layers, Lightbulb, MoreHorizontal, Paperclip, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Ring } from '@/components/shared/charts'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu'
import { Badge, Card, EmptyState, ErrorState, Progress, Skeleton } from '@/components/ui/misc'
import { daysUntil, formatDate } from '@/lib/dates'
import { cn, pluralize } from '@/lib/utils'
import { useConfirm } from '@/providers/confirm'
import type { Concept, ConceptStatus, Unit } from '@/types/database'
import { useFiles } from '../files/api'
import { Attachments, FileChip } from '../files/components'
import { useItems } from '../items/api'
import { useItemEditor } from '../items/editor'
import { ItemList } from '../items/ItemList'
import { compareItems } from '../items/selectors'
import { nextPosition, useAcademics, useConceptMutations, useUnitMutations } from './api'
import { ConceptDialog, SubjectDialog, UnitDialog } from './dialogs'
import { CONCEPT_STATUSES, nextConceptStatus, subjectColor, type UnitNode } from './tree'

export default function SubjectPage() {
  const { subjectId } = useParams()
  const [params, setParams] = useSearchParams()
  const { tree, data, isLoading, error, refetch } = useAcademics()
  const { data: items } = useItems()
  const { data: files } = useFiles()
  const editor = useItemEditor()
  const [editSubject, setEditSubject] = useState(false)
  const [unitDialog, setUnitDialog] = useState<{ unit?: Unit } | null>(null)

  const subject = tree.find((s) => s.id === subjectId)
  const openConceptId = params.get('concept')
  const openConcept = useMemo(() => {
    if (!openConceptId || !subject) return null
    for (const u of subject.units) {
      const c = u.concepts.find((x) => x.id === openConceptId)
      if (c) return { concept: c, unit: u }
    }
    return null
  }, [openConceptId, subject])

  const linkedItems = useMemo(() => (items ?? []).filter((i) => i.subject_id === subjectId).sort(compareItems('due')), [items, subjectId])
  const subjectFiles = useMemo(() => (files ?? []).filter((f) => f.subject_id === subjectId), [files, subjectId])

  const setConcept = (id: string | null) =>
    setParams(
      (p) => {
        if (id) p.set('concept', id)
        else p.delete('concept')
        return p
      },
      { replace: true },
    )

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!subject) {
    return (
      <EmptyState
        icon={<Layers />}
        title="Subject not found"
        description="It may have been deleted."
        action={
          <Button asChild variant="outline">
            <Link to="/academics">Back to academics</Link>
          </Button>
        }
      />
    )
  }

  const color = subjectColor(subject.color)

  return (
    <div>
      <Link to="/academics" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Academics
      </Link>

      <Card className="mb-6 overflow-hidden">
        <div className={cn('h-1.5', color.swatch)} />
        <div className="flex flex-wrap items-center gap-4 p-5">
          <Ring value={subject.stats.percent} size={68} label={`${subject.name} progress`} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{subject.name}</h1>
            <p className="text-sm text-muted-foreground">
              {[subject.code, subject.semester, subject.instructor, subject.credits ? `${subject.credits} credits` : null].filter(Boolean).join(' · ') || 'Add details like code and semester'}
            </p>
            {subject.description && <p className="mt-2 max-w-2xl text-sm whitespace-pre-line text-muted-foreground">{subject.description}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditSubject(true)}>
              <Pencil /> Edit
            </Button>
            <Button size="sm" onClick={() => setUnitDialog({})}>
              <Plus /> Unit
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 border-t border-border text-center text-sm">
          {CONCEPT_STATUSES.map((s) => (
            <div key={s.value} className="border-r border-border px-2 py-2.5 last:border-r-0">
              <div className="font-semibold tabular-nums">{s.value === 'completed' ? subject.stats.completed : s.value === 'learning' ? subject.stats.learning : subject.stats.notStarted}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Tabs defaultValue="units">
        <TabsList className="mb-4">
          <TabsTrigger value="units" count={subject.units.length}>
            Units & concepts
          </TabsTrigger>
          <TabsTrigger value="planner" count={linkedItems.length}>
            Tests & tasks
          </TabsTrigger>
          <TabsTrigger value="materials" count={subjectFiles.length}>
            All materials
          </TabsTrigger>
        </TabsList>

        <TabsContent value="units" className="space-y-4">
          {subject.units.length === 0 ? (
            <EmptyState
              icon={<Layers />}
              title="No units yet"
              description="Add units from your syllabus, then list the concepts in each."
              action={
                <Button onClick={() => setUnitDialog({})}>
                  <Plus /> Add unit
                </Button>
              }
            />
          ) : (
            subject.units.map((u) => <UnitCard key={u.id} unit={u} onEdit={() => setUnitDialog({ unit: u })} onOpenConcept={(c) => setConcept(c.id)} />)
          )}
        </TabsContent>

        <TabsContent value="planner">
          <Card className="px-3 py-2">
            {linkedItems.length ? (
              <ItemList items={linkedItems} />
            ) : (
              <EmptyState compact className="my-2 border-none" icon={<CalendarClock />} title="Nothing planned for this subject" />
            )}
            <div className="border-t border-border px-1 pt-2 pb-1">
              <Button variant="ghost" size="sm" onClick={() => editor.create({ category: 'test', subject_id: subject.id })}>
                <Plus /> Add test, lab or assignment
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <Card className="p-4">
            <Attachments title="Subject materials" ownerKey="subject_id" links={{ subject_id: subject.id }} folder="academic" />
            <p className="mt-2 text-xs text-muted-foreground">Includes everything attached to this subject's units, concepts and tasks.</p>
          </Card>
        </TabsContent>
      </Tabs>

      {editSubject && <SubjectDialog subject={subject} siblings={data?.subjects ?? []} onClose={() => setEditSubject(false)} />}
      {unitDialog && <UnitDialog unit={unitDialog.unit} subjectId={subject.id} siblings={subject.units} onClose={() => setUnitDialog(null)} />}
      {openConcept && <ConceptDialog key={openConcept.concept.id} concept={openConcept.concept} unit={openConcept.unit} onClose={() => setConcept(null)} />}
    </div>
  )
}

const STATUS_ICON: Record<ConceptStatus, typeof Circle> = { not_started: Circle, learning: CircleDot, completed: Check }

function UnitCard({ unit, onEdit, onOpenConcept }: { unit: UnitNode; onEdit: () => void; onOpenConcept: (c: Concept) => void }) {
  const [open, setOpen] = useState(true)
  const [showMaterials, setShowMaterials] = useState(false)
  const [draft, setDraft] = useState('')
  const { remove } = useUnitMutations()
  const { create, update } = useConceptMutations()
  const { data: files } = useFiles()
  const confirm = useConfirm()
  const unitFiles = (files ?? []).filter((f) => f.unit_id === unit.id && !f.concept_id)
  const conceptFileCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of files ?? []) if (f.concept_id) m.set(f.concept_id, (m.get(f.concept_id) ?? 0) + 1)
    return m
  }, [files])

  // Pasting a multi-line list (e.g. from a syllabus) creates one concept per line.
  const addConcepts = async () => {
    const titles = draft
      .split(/\n|;/)
      .map((t) => t.replace(/^[\s\-•*\d.)]+/, '').trim())
      .filter(Boolean)
      .slice(0, 50)
    if (!titles.length) return
    let pos = nextPosition(unit.concepts)
    setDraft('')
    for (const title of titles) await create.mutateAsync({ unit_id: unit.id, title: title.slice(0, 200), position: pos++ }).catch(() => undefined)
  }

  return (
    <Card>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left" aria-expanded={open}>
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{unit.title}</span>
            {unit.description && <span className="block truncate text-xs text-muted-foreground">{unit.description}</span>}
          </span>
        </button>
        <div className="hidden w-32 items-center gap-2 sm:flex">
          <Progress value={unit.stats.percent} size="xs" label={`${unit.title} progress`} />
          <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{unit.stats.percent}%</span>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${unit.title}`}>
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<Pencil />} onSelect={onEdit}>
              Edit unit
            </MenuItem>
            <MenuItem icon={<Paperclip />} onSelect={() => setShowMaterials(true)}>
              Unit materials
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Trash2 />}
              destructive
              onSelect={async () => {
                if (await confirm({ title: `Delete ${unit.title}?`, description: `This deletes ${pluralize(unit.concepts.length, 'concept')} in this unit. Files are kept but unlinked.`, confirmLabel: 'Delete unit', destructive: true }))
                  remove.mutate(unit.id)
              }}
            >
              Delete unit
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      {open && (
        <div className="border-t border-border px-2 py-2 sm:px-3">
          {unit.concepts.length === 0 && <p className="px-2 py-2 text-sm text-muted-foreground">No concepts yet — add the topics from this unit below.</p>}
          <ul>
            {unit.concepts.map((c) => {
              const Icon = STATUS_ICON[c.status]
              const status = CONCEPT_STATUSES.find((s) => s.value === c.status)!
              const revDays = daysUntil(c.revision_date)
              const attachments = conceptFileCounts.get(c.id) ?? 0
              return (
                <li key={c.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/60">
                  <button
                    onClick={() => update.mutate({ id: c.id, patch: { status: nextConceptStatus(c.status) } })}
                    title={`${status.label} — click to change`}
                    aria-label={`${c.title}: ${status.label}. Change status`}
                    className={cn(
                      'grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-colors',
                      c.status === 'completed' && 'border-success bg-success text-white',
                      c.status === 'learning' && 'border-sky-500 text-sky-500',
                      c.status === 'not_started' && 'border-muted-foreground/40 text-transparent hover:border-primary',
                    )}
                  >
                    <Icon className="size-3" strokeWidth={3} />
                  </button>
                  <button onClick={() => onOpenConcept(c)} className={cn('min-w-0 flex-1 cursor-pointer truncate text-left text-sm', c.status === 'completed' && 'text-muted-foreground')}>
                    {c.title}
                  </button>
                  <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                    {c.status === 'learning' && <Badge tone="info">Learning</Badge>}
                    {c.revision_date && (
                      <Badge tone={revDays !== null && revDays <= 0 ? 'warning' : 'neutral'} title="Revision date">
                        <CalendarClock /> {formatDate(c.revision_date, 'd MMM')}
                      </Badge>
                    )}
                    {c.notes && <StickyNote className="size-3.5" aria-label="Has notes" />}
                    {c.resource_url && (
                      <a href={c.resource_url} target="_blank" rel="noreferrer" aria-label="Open resource" className="hover:text-foreground">
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                    {attachments > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs">
                        <FileText className="size-3.5" />
                        {attachments}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
          <form
            className="mt-1 flex items-start gap-2 px-2"
            onSubmit={(e) => {
              e.preventDefault()
              addConcepts()
            }}
          >
            <Lightbulb className="mt-2 size-4 shrink-0 text-muted-foreground" />
            <Textarea
              value={draft}
              rows={Math.min(Math.max(draft.split('\n').length, 1), 8)}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  addConcepts()
                }
              }}
              placeholder="Add a concept (paste a list to add many)…"
              aria-label={`Add concept to ${unit.title}`}
              className="min-h-8 resize-none border-transparent bg-transparent py-1.5 shadow-none focus-visible:border-input focus-visible:bg-card"
            />
            {draft && (
              <Button type="submit" size="sm" loading={create.isPending}>
                Add{draft.includes('\n') ? ` ${draft.split('\n').filter((l) => l.trim()).length}` : ''}
              </Button>
            )}
          </form>

          {(showMaterials || unitFiles.length > 0) && (
            <div className="mt-3 border-t border-border px-2 pt-3">
              {showMaterials ? (
                <Attachments title="Unit materials" ownerKey="unit_id" links={{ unit_id: unit.id, subject_id: unit.subject_id }} folder="academic" />
              ) : (
                <div className="space-y-2">
                  <button onClick={() => setShowMaterials(true)} className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                    <Paperclip className="size-4 text-muted-foreground" /> Unit materials ({unitFiles.length})
                  </button>
                  {unitFiles.slice(0, 3).map((f) => (
                    <FileChip key={f.id} file={f} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
