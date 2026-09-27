import { zodResolver } from '@hookform/resolvers/zod'
import { Award, ExternalLink, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { Badge, Card, EmptyState, ListSkeleton, Progress } from '@/components/ui/misc'
import { formatDate, toDateInput } from '@/lib/dates'
import { groupBy, isValidUrl } from '@/lib/utils'
import { useConfirm } from '@/providers/confirm'
import type { Achievement, Skill, SkillLevel } from '@/types/database'
import { ACHIEVEMENT_KINDS, SKILL_AREAS, SKILL_LEVELS, useAchievementMutations, useAchievements, useSkillMutations, useSkills } from './api'

/* --------------------------------- Skills -------------------------------- */

const skillSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  area: z.string().min(1),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  progress: z.number().int().min(0).max(100),
  target_date: z.string(),
  notes: z.string().max(10_000),
})
type SkillValues = z.infer<typeof skillSchema>

function SkillDialog({ skill, onClose }: { skill?: Skill; onClose: () => void }) {
  const { save } = useSkillMutations()
  const { register, handleSubmit, control, formState } = useForm<SkillValues>({
    resolver: zodResolver(skillSchema),
    defaultValues: {
      name: skill?.name ?? '',
      area: skill?.area ?? 'Language',
      level: skill?.level ?? 'beginner',
      progress: skill?.progress ?? 0,
      target_date: skill?.target_date ?? '',
      notes: skill?.notes ?? '',
    },
  })
  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: skill?.id, values: { ...v, level: v.level as SkillLevel, target_date: v.target_date || null, notes: v.notes.trim() || null } })
      onClose()
    } catch {
      /* toast shown by mutation */
    }
  })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={skill ? 'Edit skill' : 'New skill'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="skill-form" loading={formState.isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="skill-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Skill" htmlFor="sk-name" error={formState.errors.name?.message} required>
          <Input id="sk-name" autoFocus placeholder="React, SQL, System Design…" {...register('name')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Area" htmlFor="sk-area">
            <Select id="sk-area" {...register('area')}>
              {SKILL_AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          </Field>
          <Field label="Level" htmlFor="sk-level">
            <Select id="sk-level" {...register('level')}>
              {SKILL_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Controller
          control={control}
          name="progress"
          render={({ field }) => (
            <Field label={`Learning progress · ${field.value}%`} htmlFor="sk-progress">
              <input id="sk-progress" type="range" min={0} max={100} step={5} value={field.value} onChange={(e) => field.onChange(Number(e.target.value))} className="w-full cursor-pointer accent-primary" />
            </Field>
          )}
        />
        <Field label="Target date" htmlFor="sk-target">
          <Input id="sk-target" type="date" {...register('target_date')} />
        </Field>
        <Field label="Notes & resources" htmlFor="sk-notes">
          <Textarea id="sk-notes" rows={3} placeholder="Courses, docs, what to learn next…" {...register('notes')} />
        </Field>
      </form>
    </Dialog>
  )
}

const LEVEL_TONE: Record<SkillLevel, 'neutral' | 'info' | 'violet' | 'success'> = { beginner: 'neutral', intermediate: 'info', advanced: 'violet', expert: 'success' }

export function SkillsPanel() {
  const { data: skills, isLoading } = useSkills()
  const { remove } = useSkillMutations()
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<{ skill?: Skill } | null>(null)
  const grouped = groupBy(skills ?? [], (s) => s.area)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Technologies and concepts you're learning, with your current level.</p>
        <Button onClick={() => setDialog({})}>
          <Plus /> Skill
        </Button>
      </div>
      {isLoading ? (
        <ListSkeleton />
      ) : !skills?.length ? (
        <EmptyState icon={<Sparkles />} title="No skills tracked yet" description="Add the languages, frameworks and concepts you're building up." action={<Button onClick={() => setDialog({})}><Plus /> Add a skill</Button>} />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([area, list]) => (
            <section key={area}>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{area}</h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list!.map((s) => (
                  <Card key={s.id} className="group p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge tone={LEVEL_TONE[s.level]}>{SKILL_LEVELS.find((l) => l.value === s.level)?.label}</Badge>
                          {s.target_date && <span className="text-xs text-muted-foreground">Target {formatDate(s.target_date, 'd MMM')}</span>}
                        </div>
                      </div>
                      <Menu>
                        <MenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.name}`}>
                            <MoreHorizontal />
                          </Button>
                        </MenuTrigger>
                        <MenuContent>
                          <MenuItem icon={<Pencil />} onSelect={() => setDialog({ skill: s })}>
                            Edit
                          </MenuItem>
                          <MenuItem
                            icon={<Trash2 />}
                            destructive
                            onSelect={async () => {
                              if (await confirm({ title: `Delete ${s.name}?`, confirmLabel: 'Delete', destructive: true })) remove.mutate(s.id)
                            }}
                          >
                            Delete
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Progress value={s.progress} label={`${s.name} progress`} />
                      <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{s.progress}%</span>
                    </div>
                    {s.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.notes}</p>}
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {dialog && <SkillDialog skill={dialog.skill} onClose={() => setDialog(null)} />}
    </div>
  )
}

/* ------------------------------ Achievements ----------------------------- */

const achievementSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  kind: z.string().min(1),
  achieved_on: z.string().min(1, 'Pick a date'),
  url: z.string().trim().refine((v) => !v || isValidUrl(v), 'Enter a full link starting with https://'),
  description: z.string().max(4000),
})
type AchievementValues = z.infer<typeof achievementSchema>

function AchievementDialog({ achievement, onClose }: { achievement?: Achievement; onClose: () => void }) {
  const { save } = useAchievementMutations()
  const { register, handleSubmit, formState } = useForm<AchievementValues>({
    resolver: zodResolver(achievementSchema),
    defaultValues: {
      title: achievement?.title ?? '',
      kind: achievement?.kind ?? 'Award',
      achieved_on: achievement?.achieved_on ?? toDateInput(new Date()),
      url: achievement?.url ?? '',
      description: achievement?.description ?? '',
    },
  })
  const errors = formState.errors
  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: achievement?.id, values: { ...v, url: v.url || null, description: v.description.trim() || null } })
      onClose()
    } catch {
      /* toast shown by mutation */
    }
  })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={achievement ? 'Edit achievement' : 'New achievement'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="ach-form" loading={formState.isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="ach-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Title" htmlFor="a-title" error={errors.title?.message} required>
          <Input id="a-title" autoFocus placeholder="Winner — College Hackathon 2026" {...register('title')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="a-kind">
            <Select id="a-kind" {...register('kind')}>
              {ACHIEVEMENT_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="a-date" error={errors.achieved_on?.message}>
            <Input id="a-date" type="date" {...register('achieved_on')} />
          </Field>
        </div>
        <Field label="Link" htmlFor="a-url" error={errors.url?.message}>
          <Input id="a-url" type="url" placeholder="https://…" {...register('url')} />
        </Field>
        <Field label="Description" htmlFor="a-desc">
          <Textarea id="a-desc" rows={3} {...register('description')} />
        </Field>
      </form>
    </Dialog>
  )
}

export function AchievementsPanel() {
  const { data: achievements, isLoading } = useAchievements()
  const { remove } = useAchievementMutations()
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<{ achievement?: Achievement } | null>(null)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Awards, wins, scholarships and milestones worth putting on your resume.</p>
        <Button onClick={() => setDialog({})}>
          <Plus /> Achievement
        </Button>
      </div>
      {isLoading ? (
        <ListSkeleton />
      ) : !achievements?.length ? (
        <EmptyState icon={<Award />} title="No achievements yet" description="Log wins as they happen — future you (and your resume) will thank you." action={<Button onClick={() => setDialog({})}><Plus /> Add achievement</Button>} />
      ) : (
        <ol className="relative ml-3 space-y-4 border-l border-border pl-6">
          {achievements.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute top-1.5 -left-[31px] grid size-4 place-items-center rounded-full bg-primary ring-4 ring-background" />
              <Card className="group p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(a.achieved_on)} · {a.kind}
                    </p>
                    <p className="font-medium">{a.title}</p>
                    {a.description && <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{a.description}</p>}
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExternalLink className="size-3" /> View
                      </a>
                    )}
                  </div>
                  <Menu>
                    <MenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.title}`}>
                        <MoreHorizontal />
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem icon={<Pencil />} onSelect={() => setDialog({ achievement: a })}>
                        Edit
                      </MenuItem>
                      <MenuItem
                        icon={<Trash2 />}
                        destructive
                        onSelect={async () => {
                          if (await confirm({ title: `Delete “${a.title}”?`, confirmLabel: 'Delete', destructive: true })) remove.mutate(a.id)
                        }}
                      >
                        Delete
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
      {dialog && <AchievementDialog achievement={dialog.achievement} onClose={() => setDialog(null)} />}
    </div>
  )
}
