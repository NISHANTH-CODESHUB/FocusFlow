import { Archive, BookOpen, GraduationCap, Layers, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppShell'
import { Ring } from '@/components/shared/charts'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { Card, EmptyState, ErrorState, Progress, Skeleton } from '@/components/ui/misc'
import { cn, pluralize } from '@/lib/utils'
import { useConfirm } from '@/providers/confirm'
import type { Subject } from '@/types/database'
import { useItems } from '../items/api'
import { isOpen } from '../items/selectors'
import { useAcademics, useSubjectMutations } from './api'
import { SubjectDialog } from './dialogs'
import { progressOf, subjectColor, type SubjectNode } from './tree'

export default function AcademicsPage() {
  const { tree, data, isLoading, error, refetch } = useAcademics()
  const [dialog, setDialog] = useState<{ subject?: Subject } | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const { data: items } = useItems()

  const visible = tree.filter((s) => s.archived === showArchived)
  const archivedCount = tree.filter((s) => s.archived).length
  const overall = useMemo(() => progressOf(tree.filter((s) => !s.archived).flatMap((s) => s.units.flatMap((u) => u.concepts))), [tree])
  const openBySubject = useMemo(() => {
    const map = new Map<string, number>()
    for (const it of items ?? []) if (it.subject_id && isOpen(it)) map.set(it.subject_id, (map.get(it.subject_id) ?? 0) + 1)
    return map
  }, [items])

  return (
    <div>
      <PageHeader
        title="Academics"
        description="Organize subjects into units and concepts, attach study material and track mastery."
        actions={
          <Button onClick={() => setDialog({})}>
            <Plus /> New subject
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : tree.length === 0 ? (
        <EmptyState
          icon={<GraduationCap />}
          title="Add your first subject"
          description="Create a subject for each course this semester, then break it into units and concepts."
          action={
            <Button onClick={() => setDialog({})}>
              <Plus /> New subject
            </Button>
          }
        />
      ) : (
        <>
          {!showArchived && (
            <Card className="mb-5 flex flex-wrap items-center gap-5 p-4">
              <Ring value={overall.percent} size={64} label="Overall academic progress" />
              <div className="flex-1">
                <p className="font-medium">Overall progress</p>
                <p className="text-sm text-muted-foreground">
                  {overall.completed} of {pluralize(overall.total, 'concept')} completed · {overall.learning} in progress
                </p>
              </div>
              <dl className="flex gap-6 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Subjects</dt>
                  <dd className="font-semibold tabular-nums">{tree.length - archivedCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Units</dt>
                  <dd className="font-semibold tabular-nums">{data?.units.length ?? 0}</dd>
                </div>
              </dl>
            </Card>
          )}

          {visible.length === 0 ? (
            <EmptyState icon={<Archive />} title="No archived subjects" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((s) => (
                <SubjectCard key={s.id} subject={s} openItems={openBySubject.get(s.id) ?? 0} onEdit={() => setDialog({ subject: s })} />
              ))}
            </div>
          )}

          {(archivedCount > 0 || showArchived) && (
            <div className="mt-6 text-center">
              <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
                <Archive /> {showArchived ? 'Back to active subjects' : `Show archived (${archivedCount})`}
              </Button>
            </div>
          )}
        </>
      )}

      {dialog && <SubjectDialog subject={dialog.subject} siblings={data?.subjects ?? []} onClose={() => setDialog(null)} />}
    </div>
  )
}

function SubjectCard({ subject, openItems, onEdit }: { subject: SubjectNode; openItems: number; onEdit: () => void }) {
  const color = subjectColor(subject.color)
  const { update, remove } = useSubjectMutations()
  const confirm = useConfirm()
  return (
    <Card className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className={cn('h-1.5', color.swatch)} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', color.soft, color.text)}>
            <BookOpen className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <Link to={`/academics/${subject.id}`} className="block truncate font-semibold after:absolute after:inset-0 hover:underline">
              {subject.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{[subject.code, subject.semester, subject.instructor].filter(Boolean).join(' · ') || 'No details'}</p>
          </div>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="relative z-10 -mt-1 -mr-1 text-muted-foreground" aria-label={`Actions for ${subject.name}`}>
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={<Pencil />} onSelect={onEdit}>
                Edit
              </MenuItem>
              <MenuItem icon={<Archive />} onSelect={() => update.mutate({ id: subject.id, patch: { archived: !subject.archived } })}>
                {subject.archived ? 'Unarchive' : 'Archive'}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<Trash2 />}
                destructive
                onSelect={async () => {
                  if (
                    await confirm({
                      title: `Delete ${subject.name}?`,
                      description: `This deletes ${pluralize(subject.units.length, 'unit')} and ${pluralize(subject.stats.total, 'concept')}. Linked planner items and files are kept but unlinked.`,
                      confirmLabel: 'Delete subject',
                      destructive: true,
                    })
                  )
                    remove.mutate(subject.id)
                }}
              >
                Delete
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
        <div className="mt-auto pt-5">
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">
              {subject.stats.completed}/{subject.stats.total} concepts
            </span>
            <span className="font-semibold tabular-nums">{subject.stats.percent}%</span>
          </div>
          <Progress value={subject.stats.percent} barClassName={color.swatch} label={`${subject.name} progress`} />
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Layers className="size-3" /> {pluralize(subject.units.length, 'unit')}
            </span>
            {openItems > 0 && <span>{pluralize(openItems, 'open task')}</span>}
          </div>
        </div>
      </div>
    </Card>
  )
}
