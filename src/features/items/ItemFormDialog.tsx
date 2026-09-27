import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { relative } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/providers/confirm'
import { useAcademics } from '../academics/api'
import { useUploadFiles } from '../files/api'
import { Attachments } from '../files/components'
import { useCreateItem, useDeleteItem, useUpdateItem } from './api'
import { CATEGORIES, CATEGORY_MAP, PRIORITIES, STATUSES, type DetailField } from './config'
import type { EditorState } from './editor'
import { emptyItemForm, itemFormSchema, itemToFormValues, toItemPayload, type ItemFormValues } from './schema'

interface Props {
  state: NonNullable<EditorState>
  onClose: () => void
}

export default function ItemFormDialog({ state, onClose }: Props) {
  const editing = state.mode === 'edit' ? state.item : null
  const [open, setOpen] = useState(true)
  const [pending, setPending] = useState<File[]>([])
  const create = useCreateItem()
  const update = useUpdateItem()
  const remove = useDeleteItem()
  const upload = useUploadFiles()
  const confirm = useConfirm()
  const { data: academics } = useAcademics()
  const subjects = (academics?.subjects ?? []).filter((s) => !s.archived || s.id === editing?.subject_id)

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: editing ? itemToFormValues(editing) : emptyItemForm(state.mode === 'create' ? state.defaults : {}),
    mode: 'onTouched',
  })
  const { register, handleSubmit, control, formState, setValue, setFocus } = form
  const errors = formState.errors
  const category = useWatch({ control, name: 'category' })
  const status = useWatch({ control, name: 'status' })
  const config = CATEGORY_MAP[category]

  useEffect(() => {
    // Focus title on open; the dialog animates in first.
    const t = setTimeout(() => setFocus('title'), 50)
    return () => clearTimeout(t)
  }, [setFocus])

  const close = async () => {
    if (formState.isDirty || pending.length) {
      const ok = await confirm({ title: 'Discard changes?', description: 'Your unsaved changes will be lost.', confirmLabel: 'Discard', destructive: true })
      if (!ok) return
    }
    setOpen(false)
    onClose()
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload = toItemPayload(values)
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: payload })
      } else {
        const item = await create.mutateAsync(payload)
        if (pending.length) {
          await upload.mutateAsync(pending.map((file) => ({ file, folder: config.folder, item_id: item.id, subject_id: item.subject_id })))
        }
      }
    } catch {
      return // the mutation's onError already showed a toast; keep the dialog open
    }
    setOpen(false)
    onClose()
  })

  const saving = create.isPending || update.isPending || upload.isPending

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      size="lg"
      title={editing ? 'Edit item' : `New ${config.label.toLowerCase()}`}
      description={editing ? `Created ${relative(editing.created_at)} · updated ${relative(editing.updated_at)}` : undefined}
      footer={
        <>
          {editing && (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 sm:mr-auto"
              onClick={async () => {
                if (await confirm({ title: `Delete “${editing.title}”?`, description: 'Attached files are kept in Files but unlinked.', confirmLabel: 'Delete', destructive: true })) {
                  remove.mutate(editing.id)
                  setOpen(false)
                  onClose()
                }
              }}
            >
              <Trash2 /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="item-form" loading={saving}>
            {editing ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        id="item-form"
        onSubmit={onSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit()
        }}
        className="space-y-5"
        noValidate
      >
        {/* Category picker */}
        <div role="radiogroup" aria-label="Category" className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap">
          {CATEGORIES.map((c) => {
            const Icon = c.icon
            const active = c.value === category
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setValue('category', c.value, { shouldDirty: true })}
                className={cn(
                  'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  active ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {c.label}
              </button>
            )
          })}
        </div>

        <Field label="Title" htmlFor="title" error={errors.title?.message} required>
          <Input id="title" placeholder={placeholderFor(category)} aria-invalid={!!errors.title} {...register('title')} className="h-10 text-base" />
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {config.hasStart && (
            <Field label="Start date" htmlFor="start_date" error={errors.start_date?.message} className="col-span-2 sm:col-span-1">
              <Input id="start_date" type="date" aria-invalid={!!errors.start_date} {...register('start_date')} />
            </Field>
          )}
          <Field label={config.dueLabel} htmlFor="due_date" error={errors.due_date?.message} className={cn(config.hasStart ? 'col-span-1' : 'col-span-2')}>
            <Input id="due_date" type="date" aria-invalid={!!errors.due_date} {...register('due_date')} />
          </Field>
          <Field label="Time" htmlFor="due_time" hint="Optional" className={cn(config.hasStart ? 'col-span-1' : 'col-span-2 sm:col-span-1')}>
            <Input id="due_time" type="time" {...register('due_time')} />
          </Field>
          {!config.hasStart && <div className="hidden sm:block" />}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Priority" htmlFor="priority">
            <Select id="priority" {...register('priority')}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" {...register('status')}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subject" htmlFor="subject_id" className="col-span-2 sm:col-span-1">
            <Select id="subject_id" {...register('subject_id')}>
              <option value="">None</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.code} · ${s.name}` : s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {config.fields.length > 0 && (
          <fieldset className="rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
            <legend className="px-1 text-xs font-medium text-muted-foreground">{config.label} details</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {config.fields.map((f) => (
                <DetailInput key={`${category}-${f.key}`} field={f} register={register} error={errors.details?.[f.key]?.message} />
              ))}
            </div>
          </fieldset>
        )}

        <Controller
          control={control}
          name="progress"
          render={({ field }) => (
            <Field label={`Progress · ${status === 'completed' ? 100 : field.value}%`} htmlFor="progress">
              <input
                id="progress"
                type="range"
                min={0}
                max={100}
                step={5}
                disabled={status === 'completed'}
                value={status === 'completed' ? 100 : field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
                className="w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
              />
            </Field>
          )}
        />

        <Field label="Description" htmlFor="description" error={errors.description?.message}>
          <Textarea id="description" rows={2} placeholder="What needs to be done?" {...register('description')} />
        </Field>

        <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
          <Textarea id="notes" rows={3} placeholder="Links, reminders, learnings…" {...register('notes')} />
        </Field>

        <Field label="Tags" htmlFor="tags" hint="Comma separated, e.g. semester-5, important" error={errors.tags?.message}>
          <Input id="tags" placeholder="semester-5, placement" {...register('tags')} />
        </Field>

        <Attachments
          ownerKey="item_id"
          links={{ item_id: editing?.id, subject_id: editing?.subject_id }}
          folder={config.folder}
          pending={pending}
          onPendingChange={setPending}
        />
      </form>
    </Dialog>
  )
}

function DetailInput({ field, register, error }: { field: DetailField; register: ReturnType<typeof useForm<ItemFormValues>>['register']; error?: string }) {
  const id = `details-${field.key}`
  const name = `details.${field.key}` as const
  return (
    <Field label={field.label} htmlFor={id} error={error} className={cn(field.wide && 'sm:col-span-2')}>
      {field.type === 'select' ? (
        <Select id={id} {...register(name)}>
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          id={id}
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
          inputMode={field.type === 'number' ? 'decimal' : undefined}
          min={field.type === 'number' ? 0 : undefined}
          placeholder={field.placeholder}
          aria-invalid={!!error}
          {...register(name)}
        />
      )}
    </Field>
  )
}

function placeholderFor(category: string): string {
  switch (category) {
    case 'test':
      return 'e.g. DBMS mid-semester exam'
    case 'lab':
      return 'e.g. OS lab — Exp 5'
    case 'assignment':
      return 'e.g. Computer Networks assignment 2'
    case 'project':
      return 'e.g. Campus event app'
    case 'hackathon':
      return 'e.g. Smart India Hackathon'
    case 'internship':
      return 'e.g. SDE Intern — Acme'
    case 'dsa':
      return 'e.g. Longest Substring Without Repeating Characters'
    case 'aptitude':
      return 'e.g. Time & Work practice set'
    case 'certification':
      return 'e.g. AWS Cloud Practitioner'
    default:
      return 'What do you need to do?'
  }
}
