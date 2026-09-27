import { Award, BookOpen, Briefcase, Download, ExternalLink, FileText, FolderKanban, FolderOpen, HardDrive, LayoutGrid, Library, List, MoreHorizontal, Pencil, Search, Shield, Trash2, Upload, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Segmented } from '@/components/ui/menu'
import { Card, EmptyState, ErrorState, ListSkeleton } from '@/components/ui/misc'
import { formatDate } from '@/lib/dates'
import { cn, formatBytes, pluralize, splitList } from '@/lib/utils'
import { useConfirm } from '@/providers/confirm'
import type { FileFolder, FileRecord } from '@/types/database'
import { useAcademics } from '../academics/api'
import { useItems } from '../items/api'
import { CATEGORIES, CATEGORY_MAP } from '../items/config'
import { openFile, useDeleteFile, useFiles, useUpdateFile, useUploadFiles, type FileLinks } from './api'
import { DropZone, FileTypeIcon } from './components'

export const FOLDERS: ReadonlyArray<{ value: FileFolder; label: string; icon: typeof FileText }> = [
  { value: 'certificates', label: 'Certificates', icon: Award },
  { value: 'academic', label: 'Academic materials', icon: BookOpen },
  { value: 'study', label: 'Study materials', icon: Library },
  { value: 'projects', label: 'Project documents', icon: FolderKanban },
  { value: 'resume', label: 'Resume & career', icon: Briefcase },
  { value: 'important', label: 'Important documents', icon: Shield },
  { value: 'other', label: 'Other', icon: FolderOpen },
]
const folderLabel = (f: FileFolder) => FOLDERS.find((x) => x.value === f)!.label

/** Resolves a file's links to human labels ("DBMS › Unit 2", "Project: Campus app"). */
function useLinkLabels() {
  const { data: academics } = useAcademics()
  const { data: items } = useItems()
  return useMemo(() => {
    const subjects = new Map((academics?.subjects ?? []).map((s) => [s.id, s.code || s.name]))
    const units = new Map((academics?.units ?? []).map((u) => [u.id, u.title]))
    const concepts = new Map((academics?.concepts ?? []).map((c) => [c.id, c.title]))
    const itemMap = new Map((items ?? []).map((i) => [i.id, i]))
    return (f: FileRecord): string[] => {
      const out: string[] = []
      if (f.item_id && itemMap.has(f.item_id)) {
        const it = itemMap.get(f.item_id)!
        out.push(`${CATEGORY_MAP[it.category].label}: ${it.title}`)
      }
      const academic = [f.subject_id && subjects.get(f.subject_id), f.unit_id && units.get(f.unit_id), f.concept_id && concepts.get(f.concept_id)].filter(Boolean)
      if (academic.length) out.push(academic.join(' › '))
      return out
    }
  }, [academics, items])
}

export default function FilesPage() {
  const [params, setParams] = useSearchParams()
  const folder = (params.get('folder') as FileFolder | null) ?? null
  const [query, setQuery] = useState('')
  const [layout, setLayout] = useState<'grid' | 'list'>('list')
  const [sort, setSort] = useState<'newest' | 'name' | 'size'>('newest')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editing, setEditing] = useState<FileRecord | null>(null)
  const { data: files, isLoading, error, refetch } = useFiles()
  const linkLabels = useLinkLabels()

  const counts = useMemo(() => {
    const m = new Map<FileFolder, number>()
    for (const f of files ?? []) m.set(f.folder, (m.get(f.folder) ?? 0) + 1)
    return m
  }, [files])
  const totalBytes = (files ?? []).reduce((s, f) => s + f.size_bytes, 0)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (files ?? [])
      .filter((f) => !folder || f.folder === folder)
      .filter((f) => !q || [f.name, f.description, f.tags.join(' '), ...linkLabels(f)].some((s) => s?.toLowerCase().includes(q)))
      .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'size' ? b.size_bytes - a.size_bytes : b.created_at.localeCompare(a.created_at)))
  }, [files, folder, query, sort, linkLabels])

  const setFolder = (f: FileFolder | null) =>
    setParams(
      (p) => {
        if (f) p.set('folder', f)
        else p.delete('folder')
        return p
      },
      { replace: true },
    )

  return (
    <div>
      <PageHeader
        title="Files & documents"
        description="Certificates, notes, project docs and important papers — linked to the subjects and work they belong to."
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <Upload /> Upload
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
        <nav aria-label="Folders" className="scrollbar-thin -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          <FolderButton active={!folder} onClick={() => setFolder(null)} icon={<HardDrive />} label="All files" count={files?.length ?? 0} />
          {FOLDERS.map((f) => (
            <FolderButton key={f.value} active={folder === f.value} onClick={() => setFolder(f.value)} icon={<f.icon />} label={f.label} count={counts.get(f.value) ?? 0} />
          ))}
          <p className="mt-3 hidden px-3 text-xs text-muted-foreground lg:block">{formatBytes(totalBytes)} used · private to you</p>
        </nav>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files…" aria-label="Search files" className="pl-8" />
            </div>
            <Select aria-label="Sort files" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="w-32">
              <option value="newest">Newest</option>
              <option value="name">Name</option>
              <option value="size">Largest</option>
            </Select>
            <Segmented
              ariaLabel="Layout"
              value={layout}
              onChange={setLayout}
              options={[
                { value: 'list', label: 'List', icon: <List /> },
                { value: 'grid', label: 'Grid', icon: <LayoutGrid /> },
              ]}
            />
          </div>

          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<FolderOpen />}
              title={files?.length ? 'No files match' : 'No files yet'}
              description={files?.length ? 'Try another folder or search term.' : 'Upload certificates, notes, PDFs and project documents. Files are private to your account.'}
              action={
                <Button onClick={() => setUploadOpen(true)}>
                  <Upload /> Upload files
                </Button>
              }
            />
          ) : layout === 'list' ? (
            <Card className="divide-y divide-border">
              {shown.map((f) => (
                <div key={f.id} className="group flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <FileTypeIcon file={f} />
                  </span>
                  <button onClick={() => openFile(f)} className="min-w-0 flex-1 cursor-pointer text-left">
                    <span className="block truncate text-sm font-medium hover:underline">{f.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[formatBytes(f.size_bytes), formatDate(f.created_at, 'd MMM yyyy'), !folder && folderLabel(f.folder), ...linkLabels(f)].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                  <FileMenu file={f} onEdit={() => setEditing(f)} />
                </div>
              ))}
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((f) => (
                <Card key={f.id} className="group flex flex-col p-3">
                  <button onClick={() => openFile(f)} className="grid aspect-[4/3] cursor-pointer place-items-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-accent">
                    <FileTypeIcon file={f} className="size-8" />
                  </button>
                  <div className="mt-2 flex items-start gap-1">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={f.name}>
                        {f.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{linkLabels(f)[0] ?? formatBytes(f.size_bytes)}</p>
                    </div>
                    <FileMenu file={f} onEdit={() => setEditing(f)} />
                  </div>
                </Card>
              ))}
            </div>
          )}
          {shown.length > 0 && <p className="mt-3 text-center text-xs text-muted-foreground">{pluralize(shown.length, 'file')}</p>}
        </div>
      </div>

      {uploadOpen && <UploadDialog defaultFolder={folder ?? 'other'} onClose={() => setUploadOpen(false)} />}
      {editing && <EditFileDialog file={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function FolderButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      aria-current={active || undefined}
      className={cn(
        'flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
        active ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <span className="text-xs tabular-nums opacity-70">{count}</span>
    </button>
  )
}

function FileMenu({ file, onEdit }: { file: FileRecord; onEdit: () => void }) {
  const remove = useDeleteFile()
  const confirm = useConfirm()
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${file.name}`} className="shrink-0 text-muted-foreground">
          <MoreHorizontal />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem icon={<ExternalLink />} onSelect={() => openFile(file)}>
          Open
        </MenuItem>
        <MenuItem icon={<Download />} onSelect={() => openFile(file, true)}>
          Download
        </MenuItem>
        <MenuItem icon={<Pencil />} onSelect={onEdit}>
          Rename, move & link
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<Trash2 />}
          destructive
          onSelect={async () => {
            if (await confirm({ title: `Delete ${file.name}?`, description: 'The file is removed from storage permanently.', confirmLabel: 'Delete', destructive: true })) remove.mutate(file)
          }}
        >
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

/* ------------------------------ Link selector ----------------------------- */

function LinkFields({ links, onChange }: { links: FileLinks; onChange: (links: FileLinks) => void }) {
  const { data: academics } = useAcademics()
  const { data: items } = useItems()
  const units = (academics?.units ?? []).filter((u) => u.subject_id === links.subject_id)
  const concepts = (academics?.concepts ?? []).filter((c) => c.unit_id === links.unit_id)
  const linkable = (items ?? []).filter((i) => i.status !== 'cancelled').sort((a, b) => a.title.localeCompare(b.title))

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Subject" htmlFor="l-subject">
        <Select id="l-subject" value={links.subject_id ?? ''} onChange={(e) => onChange({ ...links, subject_id: e.target.value || null, unit_id: null, concept_id: null })}>
          <option value="">None</option>
          {(academics?.subjects ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.code ? `${s.code} · ${s.name}` : s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Unit" htmlFor="l-unit">
        <Select id="l-unit" disabled={!links.subject_id} value={links.unit_id ?? ''} onChange={(e) => onChange({ ...links, unit_id: e.target.value || null, concept_id: null })}>
          <option value="">None</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.title}
            </option>
          ))}
        </Select>
      </Field>
      {links.unit_id && (
        <Field label="Concept" htmlFor="l-concept">
          <Select id="l-concept" value={links.concept_id ?? ''} onChange={(e) => onChange({ ...links, concept_id: e.target.value || null })}>
            <option value="">None</option>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Task / project / certification" htmlFor="l-item" className={cn(!links.unit_id && 'sm:col-span-2')}>
        <Select id="l-item" value={links.item_id ?? ''} onChange={(e) => onChange({ ...links, item_id: e.target.value || null })}>
          <option value="">None</option>
          {CATEGORIES.map((c) => {
            const group = linkable.filter((i) => i.category === c.value)
            if (!group.length) return null
            return (
              <optgroup key={c.value} label={c.plural}>
                {group.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </Select>
      </Field>
    </div>
  )
}

/* ------------------------------ Upload dialog ----------------------------- */

function UploadDialog({ defaultFolder, onClose }: { defaultFolder: FileFolder; onClose: () => void }) {
  const [queue, setQueue] = useState<File[]>([])
  const [folder, setFolder] = useState<FileFolder>(defaultFolder)
  const [links, setLinks] = useState<FileLinks>({})
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const upload = useUploadFiles()

  const submit = async () => {
    const result = await upload.mutateAsync(queue.map((file) => ({ file, folder, ...links, description, tags: splitList(tags).slice(0, 20) }))).catch(() => null)
    if (result && result.failed.length === 0) onClose()
    else if (result) setQueue((q) => q.filter((f) => !result.uploaded.some((u) => u.name === f.name.slice(0, 255))))
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !upload.isPending && onClose()}
      title="Upload files"
      description="Files are stored privately in your account."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!queue.length} loading={upload.isPending}>
            Upload {queue.length ? pluralize(queue.length, 'file') : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <DropZone onFiles={(f) => setQueue((q) => [...q, ...f])} disabled={upload.isPending} />
        {queue.length > 0 && (
          <ul className="space-y-1.5">
            {queue.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-sm">
                <FileTypeIcon file={{ mime_type: f.type, name: f.name }} className="text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${f.name}`} onClick={() => setQueue((q) => q.filter((_, j) => j !== i))} disabled={upload.isPending}>
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Field label="Folder" htmlFor="u-folder">
          <Select id="u-folder" value={folder} onChange={(e) => setFolder(e.target.value as FileFolder)}>
            {FOLDERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        <LinkFields links={links} onChange={setLinks} />
        <Field label="Description" htmlFor="u-desc">
          <Textarea id="u-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </Field>
        <Field label="Tags" htmlFor="u-tags" hint="Comma separated">
          <Input id="u-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="semester-5, final" />
        </Field>
      </div>
    </Dialog>
  )
}

/* ------------------------------- Edit dialog ------------------------------ */

function EditFileDialog({ file, onClose }: { file: FileRecord; onClose: () => void }) {
  const [name, setName] = useState(file.name)
  const [folder, setFolder] = useState<FileFolder>(file.folder)
  const [links, setLinks] = useState<FileLinks>({ subject_id: file.subject_id, unit_id: file.unit_id, concept_id: file.concept_id, item_id: file.item_id })
  const [description, setDescription] = useState(file.description ?? '')
  const [tags, setTags] = useState(file.tags.join(', '))
  const update = useUpdateFile()
  const nameError = !name.trim() ? 'Name is required' : name.length > 255 ? 'Name is too long' : undefined

  const submit = async () => {
    if (nameError) return
    try {
      await update.mutateAsync({
        id: file.id,
        patch: { name: name.trim(), folder, description: description.trim() || null, tags: splitList(tags).slice(0, 20), subject_id: links.subject_id ?? null, unit_id: links.unit_id ?? null, concept_id: links.concept_id ?? null, item_id: links.item_id ?? null },
      })
      onClose()
    } catch {
      /* toast shown by mutation */
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Edit file"
      description={`${formatBytes(file.size_bytes)} · uploaded ${formatDate(file.created_at)}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={update.isPending} disabled={!!nameError}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="f-name" error={nameError}>
          <Input id="f-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError} />
        </Field>
        <Field label="Folder" htmlFor="f-folder">
          <Select id="f-folder" value={folder} onChange={(e) => setFolder(e.target.value as FileFolder)}>
            {FOLDERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        <LinkFields links={links} onChange={setLinks} />
        <Field label="Description" htmlFor="f-desc">
          <Textarea id="f-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </Field>
        <Field label="Tags" htmlFor="f-tags" hint="Comma separated">
          <Input id="f-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}
