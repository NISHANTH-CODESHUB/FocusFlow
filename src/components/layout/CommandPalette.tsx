import { BookOpen, CornerDownLeft, Layers, Lightbulb, Plus, Search } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAcademics } from '@/features/academics/api'
import { openFile, useFiles } from '@/features/files/api'
import { FileTypeIcon } from '@/features/files/components'
import { useItems } from '@/features/items/api'
import { CategoryIcon, DueLabel } from '@/features/items/components'
import { CATEGORIES } from '@/features/items/config'
import { useItemEditor } from '@/features/items/editor'
import { cn } from '@/lib/utils'
import { NAV, SETTINGS_NAV } from './nav'

interface Result {
  id: string
  group: string
  label: string
  hint?: ReactNode
  icon: ReactNode
  run: () => void
}

const LIMIT = 6

export default function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const editor = useItemEditor()
  const { data: items } = useItems()
  const { data: academics } = useAcademics()
  const { data: files } = useFiles()

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    const match = (...parts: Array<string | null | undefined>) => !q || parts.some((p) => p?.toLowerCase().includes(q))
    const close = (fn: () => void) => () => {
      onOpenChange(false)
      fn()
    }
    const out: Result[] = []

    const pages = [...NAV, SETTINGS_NAV].filter((n) => match(n.label, n.description))
    out.push(
      ...pages.map((n) => ({
        id: `page-${n.to}`,
        group: 'Go to',
        label: n.label,
        hint: n.description,
        icon: <n.icon className="size-4" />,
        run: close(() => navigate(n.to)),
      })),
    )

    const creates = CATEGORIES.filter((c) => match(`new ${c.label}`, `add ${c.label}`, c.plural))
    out.push(
      ...(q ? creates : creates.slice(0, 4)).map((c) => ({
        id: `new-${c.value}`,
        group: 'Create',
        label: `New ${c.label.toLowerCase()}`,
        icon: <Plus className="size-4" />,
        run: close(() => editor.create({ category: c.value })),
      })),
    )

    if (q) {
      const itemHits = (items ?? []).filter((it) => match(it.title, it.description, it.notes, it.tags.join(' '))).slice(0, LIMIT)
      out.push(
        ...itemHits.map((it) => ({
          id: `item-${it.id}`,
          group: 'Planner',
          label: it.title,
          hint: <DueLabel item={it} />,
          icon: <CategoryIcon category={it.category} />,
          run: close(() => editor.edit(it)),
        })),
      )
      const subjectHits = (academics?.subjects ?? []).filter((s) => match(s.name, s.code)).slice(0, LIMIT)
      out.push(
        ...subjectHits.map((s) => ({
          id: `subject-${s.id}`,
          group: 'Subjects',
          label: s.code ? `${s.code} · ${s.name}` : s.name,
          icon: <BookOpen className="size-4" />,
          run: close(() => navigate(`/academics/${s.id}`)),
        })),
      )
      const unitHits = (academics?.units ?? []).filter((u) => match(u.title, u.description)).slice(0, LIMIT)
      out.push(
        ...unitHits.map((u) => ({
          id: `unit-${u.id}`,
          group: 'Units',
          label: u.title,
          icon: <Layers className="size-4" />,
          run: close(() => navigate(`/academics/${u.subject_id}`)),
        })),
      )
      const unitSubject = new Map((academics?.units ?? []).map((u) => [u.id, u.subject_id]))
      const conceptHits = (academics?.concepts ?? []).filter((c) => match(c.title, c.notes)).slice(0, LIMIT)
      out.push(
        ...conceptHits.map((c) => ({
          id: `concept-${c.id}`,
          group: 'Concepts',
          label: c.title,
          icon: <Lightbulb className="size-4" />,
          run: close(() => navigate(`/academics/${unitSubject.get(c.unit_id)}?concept=${c.id}`)),
        })),
      )
      const fileHits = (files ?? []).filter((f) => match(f.name, f.description, f.tags.join(' '))).slice(0, LIMIT)
      out.push(
        ...fileHits.map((f) => ({
          id: `file-${f.id}`,
          group: 'Files',
          label: f.name,
          icon: <FileTypeIcon file={f} />,
          run: close(() => void openFile(f)),
        })),
      )
    }
    return out
  }, [query, items, academics, files, navigate, editor, onOpenChange])

  const clamped = Math.min(active, Math.max(results.length - 1, 0))

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % Math.max(results.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + results.length) % Math.max(results.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      results[clamped]?.run()
    }
  }

  let lastGroup = ''
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in" />
        <D.Content
          onKeyDown={onKeyDown}
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl outline-none data-[state=open]:animate-in"
        >
          <D.Title className="sr-only">Search</D.Title>
          <D.Description className="sr-only">Search pages, planner items, subjects, concepts and files</D.Description>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              placeholder="Search tasks, subjects, concepts, files…"
              className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              role="combobox"
              aria-expanded
              aria-controls="palette-results"
              aria-activedescendant={results[clamped]?.id}
            />
            <kbd className="hidden rounded border border-border bg-muted px-1.5 text-[10px] text-muted-foreground sm:inline">Esc</kbd>
          </div>
          <div id="palette-results" role="listbox" className="scrollbar-thin overflow-y-auto p-2">
            {results.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matches for “{query}”</p>}
            {results.map((r, i) => {
              const header = r.group !== lastGroup ? r.group : null
              lastGroup = r.group
              return (
                <div key={r.id}>
                  {header && <div className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{header}</div>}
                  <div
                    id={r.id}
                    role="option"
                    aria-selected={i === clamped}
                    onMouseMove={() => setActive(i)}
                    onClick={r.run}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm',
                      i === clamped ? 'bg-accent text-foreground' : 'text-foreground/90',
                    )}
                  >
                    <span className="text-muted-foreground">{r.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{r.label}</span>
                    {r.hint && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{r.hint}</span>}
                    {i === clamped && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
                  </div>
                </div>
              )
            })}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
