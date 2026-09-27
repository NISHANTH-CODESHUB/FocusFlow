import { Check, Copy, MoreHorizontal, Paperclip, Pencil, Trash2 } from 'lucide-react'
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { Progress } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/providers/confirm'
import type { Item } from '@/types/database'
import { statusPatch, useCreateItem, useDeleteItem, useToggleComplete, useUpdateItem } from './api'
import { CategoryChip, DueLabel, PriorityFlag, StatusBadge } from './components'
import { STATUSES } from './config'
import { useItemEditor } from './editor'

interface ItemRowProps {
  item: Item
  subjectName?: string
  attachments?: number
  compact?: boolean
  hideCategory?: boolean
}

export const ItemRow = memo(function ItemRow({ item, subjectName, attachments = 0, compact, hideCategory }: ItemRowProps) {
  const editor = useItemEditor()
  const toggle = useToggleComplete()
  const done = item.status === 'completed'
  const cancelled = item.status === 'cancelled'

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-transparent px-2 transition-colors hover:border-border hover:bg-card',
        compact ? 'py-1.5' : 'py-2.5',
      )}
    >
      <button
        onClick={() => toggle(item)}
        aria-label={done ? `Mark “${item.title}” as not done` : `Mark “${item.title}” as done`}
        className={cn(
          'grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-colors',
          done ? 'border-success bg-success text-white' : 'border-muted-foreground/40 hover:border-primary',
        )}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </button>

      <button onClick={() => editor.edit(item)} className="min-w-0 flex-1 cursor-pointer text-left">
        <div className="flex items-center gap-2">
          <span className={cn('truncate text-sm font-medium', (done || cancelled) && 'text-muted-foreground line-through')}>
            {item.title}
          </span>
          <PriorityFlag priority={item.priority} />
        </div>
        {!compact && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {!hideCategory && <CategoryChip category={item.category} />}
            <DueLabel item={item} />
            {subjectName && <span className="truncate text-xs text-muted-foreground">{subjectName}</span>}
            {item.status !== 'todo' && !done && <StatusBadge status={item.status} />}
            {attachments > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                <Paperclip className="size-3" aria-hidden />
                {attachments}
              </span>
            )}
          </div>
        )}
      </button>

      {!compact && item.progress > 0 && !done && (
        <div className="hidden w-20 items-center gap-2 sm:flex" title={`${item.progress}% done`}>
          <Progress value={item.progress} size="xs" label={`${item.title} progress`} />
          <span className="w-8 text-right text-[11px] text-muted-foreground tabular-nums">{item.progress}%</span>
        </div>
      )}
      {compact && <DueLabel item={item} className="hidden sm:inline-flex" />}
      <ItemActions item={item} />
    </div>
  )
})

export function ItemActions({ item, className }: { item: Item; className?: string }) {
  const editor = useItemEditor()
  const update = useUpdateItem()
  const create = useCreateItem()
  const remove = useDeleteItem()
  const confirm = useConfirm()

  const duplicate = () => {
    const { id: _id, user_id: _u, created_at: _c, updated_at: _up, completed_at: _ca, ...rest } = item
    create.mutate({ ...rest, title: `${item.title} (copy)`, status: 'todo', progress: 0 })
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${item.title}`}
          className={cn('shrink-0 text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100', className)}
        >
          <MoreHorizontal />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem icon={<Pencil />} onSelect={() => editor.edit(item)}>
          Open & edit
        </MenuItem>
        <MenuItem icon={<Copy />} onSelect={duplicate}>
          Duplicate
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>Set status</MenuLabel>
        {STATUSES.map((s) => (
          <MenuItem key={s.value} disabled={s.value === item.status} onSelect={() => update.mutate({ id: item.id, patch: statusPatch(item, s.value) })}>
            <span className="pl-6">{s.label}</span>
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem
          icon={<Trash2 />}
          destructive
          onSelect={async () => {
            if (await confirm({ title: `Delete “${item.title}”?`, description: 'Attached files are kept in Files but unlinked.', confirmLabel: 'Delete', destructive: true }))
              remove.mutate(item.id)
          }}
        >
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
