import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { cn, isValidUrl } from '@/lib/utils'
import type { Concept, ConceptStatus, Subject, Unit } from '@/types/database'
import { Attachments } from '../files/components'
import { nextPosition, useConceptMutations, useSubjectMutations, useUnitMutations } from './api'
import { CONCEPT_STATUSES, SUBJECT_COLORS } from './tree'

/* -------------------------------- Subject -------------------------------- */

const subjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  code: z.string().trim().max(30),
  semester: z.string().trim().max(40),
  instructor: z.string().trim().max(120),
  credits: z.string().refine((v) => v === '' || (Number(v) >= 0 && Number(v) <= 50), 'Between 0 and 50'),
  color: z.string(),
  description: z.string().max(4000),
})
type SubjectValues = z.infer<typeof subjectSchema>

export function SubjectDialog({ subject, siblings, onClose }: { subject?: Subject; siblings: Subject[]; onClose: () => void }) {
  const { create, update } = useSubjectMutations()
  const { register, handleSubmit, formState, watch, setValue } = useForm<SubjectValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      name: subject?.name ?? '',
      code: subject?.code ?? '',
      semester: subject?.semester ?? siblings.at(-1)?.semester ?? '',
      instructor: subject?.instructor ?? '',
      credits: subject?.credits?.toString() ?? '',
      color: subject?.color ?? SUBJECT_COLORS[siblings.length % SUBJECT_COLORS.length]!.value,
      description: subject?.description ?? '',
    },
  })
  const color = watch('color')
  const errors = formState.errors

  const onSubmit = handleSubmit(async (v) => {
    const payload = {
      name: v.name,
      code: v.code || null,
      semester: v.semester || null,
      instructor: v.instructor || null,
      credits: v.credits === '' ? null : Number(v.credits),
      color: v.color,
      description: v.description.trim() || null,
    }
    try {
      if (subject) await update.mutateAsync({ id: subject.id, patch: payload })
      else await create.mutateAsync({ ...payload, position: nextPosition(siblings) })
      onClose()
    } catch {
      /* toast shown by mutation */
    }
  })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={subject ? 'Edit subject' : 'New subject'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="subject-form" loading={formState.isSubmitting}>
            {subject ? 'Save' : 'Create subject'}
          </Button>
        </>
      }
    >
      <form id="subject-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Subject name" htmlFor="s-name" error={errors.name?.message} required className="col-span-2">
            <Input id="s-name" autoFocus placeholder="Operating Systems" aria-invalid={!!errors.name} {...register('name')} />
          </Field>
          <Field label="Code" htmlFor="s-code" error={errors.code?.message}>
            <Input id="s-code" placeholder="CS301" {...register('code')} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Semester" htmlFor="s-sem">
            <Input id="s-sem" placeholder="Sem 5" {...register('semester')} />
          </Field>
          <Field label="Credits" htmlFor="s-cred" error={errors.credits?.message}>
            <Input id="s-cred" type="number" step="0.5" min={0} {...register('credits')} />
          </Field>
          <Field label="Instructor" htmlFor="s-inst">
            <Input id="s-inst" {...register('instructor')} />
          </Field>
        </div>
        <Field label="Color">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Subject color">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={color === c.value}
                aria-label={c.value}
                onClick={() => setValue('color', c.value, { shouldDirty: true })}
                className={cn('size-7 cursor-pointer rounded-full ring-offset-2 ring-offset-card transition', c.swatch, color === c.value && 'ring-2 ring-foreground')}
              />
            ))}
          </div>
        </Field>
        <Field label="Description" htmlFor="s-desc">
          <Textarea id="s-desc" rows={2} placeholder="Syllabus overview, exam pattern…" {...register('description')} />
        </Field>
      </form>
    </Dialog>
  )
}

/* ---------------------------------- Unit --------------------------------- */

const unitSchema = z.object({ title: z.string().trim().min(1, 'Title is required').max(160), description: z.string().max(4000) })

export function UnitDialog({ unit, subjectId, siblings, onClose }: { unit?: Unit; subjectId: string; siblings: Unit[]; onClose: () => void }) {
  const { create, update } = useUnitMutations()
  const { register, handleSubmit, formState } = useForm<z.infer<typeof unitSchema>>({
    resolver: zodResolver(unitSchema),
    defaultValues: { title: unit?.title ?? `Unit ${siblings.length + 1}: `, description: unit?.description ?? '' },
  })
  const onSubmit = handleSubmit(async (v) => {
    const payload = { title: v.title, description: v.description.trim() || null }
    try {
      if (unit) await update.mutateAsync({ id: unit.id, patch: payload })
      else await create.mutateAsync({ ...payload, subject_id: subjectId, position: nextPosition(siblings) })
      onClose()
    } catch {
      /* toast shown by mutation */
    }
  })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={unit ? 'Edit unit' : 'New unit'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="unit-form" loading={formState.isSubmitting}>
            {unit ? 'Save' : 'Add unit'}
          </Button>
        </>
      }
    >
      <form id="unit-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Title" htmlFor="u-title" error={formState.errors.title?.message} required>
          <Input id="u-title" autoFocus {...register('title')} />
        </Field>
        <Field label="Description" htmlFor="u-desc">
          <Textarea id="u-desc" rows={2} placeholder="Topics covered, reference chapters…" {...register('description')} />
        </Field>
      </form>
    </Dialog>
  )
}

/* -------------------------------- Concept -------------------------------- */

const conceptSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  status: z.enum(['not_started', 'learning', 'completed']),
  revision_date: z.string(),
  resource_url: z.string().trim().refine((v) => !v || isValidUrl(v), 'Enter a full link starting with https://'),
  notes: z.string().max(20_000, 'Notes are too long'),
})
type ConceptValues = z.infer<typeof conceptSchema>

export function ConceptDialog({ concept, unit, onClose }: { concept: Concept; unit: Unit; onClose: () => void }) {
  const { update, remove } = useConceptMutations()
  const { register, handleSubmit, formState } = useForm<ConceptValues>({
    resolver: zodResolver(conceptSchema),
    defaultValues: {
      title: concept.title,
      status: concept.status,
      revision_date: concept.revision_date ?? '',
      resource_url: concept.resource_url ?? '',
      notes: concept.notes ?? '',
    },
  })
  const errors = formState.errors
  const onSubmit = handleSubmit(async (v) => {
    try {
      await update.mutateAsync({
        id: concept.id,
        patch: { title: v.title, status: v.status as ConceptStatus, revision_date: v.revision_date || null, resource_url: v.resource_url || null, notes: v.notes.trim() || null },
      })
      onClose()
    } catch {
      /* toast shown by mutation */
    }
  })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Concept"
      description={unit.title}
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 sm:mr-auto"
            onClick={() => {
              remove.mutate(concept.id)
              onClose()
            }}
          >
            Delete
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="concept-form" loading={formState.isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="concept-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Title" htmlFor="c-title" error={errors.title?.message} required>
          <Input id="c-title" {...register('title')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status" htmlFor="c-status">
            <Select id="c-status" {...register('status')}>
              {CONCEPT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Revise on" htmlFor="c-rev" hint="Shows on your dashboard when due">
            <Input id="c-rev" type="date" {...register('revision_date')} />
          </Field>
        </div>
        <Field label="Resource link" htmlFor="c-url" error={errors.resource_url?.message}>
          <Input id="c-url" type="url" placeholder="https://youtube.com/… or NPTEL lecture" {...register('resource_url')} />
        </Field>
        <Field label="Notes" htmlFor="c-notes" error={errors.notes?.message}>
          <Textarea id="c-notes" rows={8} placeholder="Key definitions, formulas, diagrams to remember…" className="font-[inherit]" {...register('notes')} />
        </Field>
        <Attachments
          title="Study materials"
          ownerKey="concept_id"
          links={{ concept_id: concept.id, unit_id: unit.id, subject_id: unit.subject_id }}
          folder="study"
        />
      </form>
    </Dialog>
  )
}
