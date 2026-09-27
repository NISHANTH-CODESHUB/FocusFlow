import { Download, ExternalLink, File, FileArchive, FileCode, FileImage, FileSpreadsheet, FileText, Paperclip, Presentation, Trash2, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/misc'
import { relative } from '@/lib/dates'
import { cn, formatBytes } from '@/lib/utils'
import { useConfirm } from '@/providers/confirm'
import type { FileFolder, FileRecord } from '@/types/database'
import { ACCEPTED_FILES, openFile, useDeleteFile, useFiles, useUploadFiles, validateFile, type FileLinks } from './api'

export function fileIcon(mime: string | null, name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (mime?.startsWith('image/')) return FileImage
  if (mime === 'application/pdf' || ['doc', 'docx', 'txt', 'md', 'pdf'].includes(ext)) return FileText
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet
  if (['ppt', 'pptx'].includes(ext)) return Presentation
  if (['zip', 'rar', '7z'].includes(ext)) return FileArchive
  if (['js', 'ts', 'py', 'java', 'c', 'cpp', 'json', 'ipynb'].includes(ext)) return FileCode
  return File
}

export function FileTypeIcon({ file, className }: { file: Pick<FileRecord, 'mime_type' | 'name'>; className?: string }) {
  const Icon = fileIcon(file.mime_type, file.name)
  return <Icon className={cn('size-4', className)} aria-hidden />
}

/** Drop zone + hidden input; hands validated files to the caller. */
export function DropZone({ onFiles, compact, disabled }: { onFiles: (files: File[]) => void; compact?: boolean; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const accept = (list: FileList | null) => {
    if (!list?.length) return
    const ok: File[] = []
    for (const f of Array.from(list)) {
      const problem = validateFile(f)
      if (problem) toast.error(problem)
      else ok.push(f)
    }
    if (ok.length) onFiles(ok)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    if (!disabled) accept(e.dataTransfer.files)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input text-center transition-colors',
        compact ? 'px-3 py-3' : 'px-4 py-8',
        over && 'border-primary bg-primary-soft',
        disabled && 'opacity-60',
      )}
    >
      <input ref={input} type="file" multiple accept={ACCEPTED_FILES} className="sr-only" tabIndex={-1} onChange={(e) => {
        accept(e.target.files)
        e.target.value = ''
      }} />
      {!compact && <Upload className="mb-1 size-5 text-muted-foreground" aria-hidden />}
      <p className="text-sm text-muted-foreground">
        Drop files here or{' '}
        <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="cursor-pointer font-medium text-primary hover:underline">
          browse
        </button>
      </p>
      {!compact && <p className="text-xs text-muted-foreground/80">PDF, docs, slides, images, code · up to 50 MB each</p>}
    </div>
  )
}

export function FileChip({ file, onRemove }: { file: FileRecord; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-sm">
      <FileTypeIcon file={file} className="text-muted-foreground" />
      <button type="button" onClick={() => openFile(file)} className="min-w-0 flex-1 cursor-pointer truncate text-left hover:underline" title={file.name}>
        {file.name}
      </button>
      <span className="hidden text-xs text-muted-foreground sm:inline">{formatBytes(file.size_bytes)}</span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Open ${file.name}`} onClick={() => openFile(file)}>
        <ExternalLink />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Download ${file.name}`} onClick={() => openFile(file, true)}>
        <Download />
      </Button>
      {onRemove && (
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${file.name}`} onClick={onRemove}>
          <Trash2 />
        </Button>
      )}
    </div>
  )
}

interface AttachmentsProps {
  /** Records the new files are linked to. When no id is present yet, files are queued. */
  links: FileLinks
  folder: FileFolder
  /** Which link column identifies the owner for listing. */
  ownerKey: keyof FileLinks
  pending?: File[]
  onPendingChange?: (files: File[]) => void
  title?: string
}

/**
 * Attachments for a record. For a saved record, uploads go straight to storage;
 * for a record being created, files are queued and uploaded after it is saved.
 */
export function Attachments({ links, folder, ownerKey, pending, onPendingChange, title = 'Attachments' }: AttachmentsProps) {
  const ownerId = links[ownerKey]
  const { data: files, isLoading } = useFiles()
  const upload = useUploadFiles()
  const remove = useDeleteFile()
  const confirm = useConfirm()

  const attached = useMemo(() => (ownerId ? (files ?? []).filter((f) => f[ownerKey] === ownerId) : []), [files, ownerId, ownerKey])

  const onFiles = (list: File[]) => {
    if (ownerId) upload.mutate(list.map((file) => ({ file, folder, ...links })))
    else onPendingChange?.([...(pending ?? []), ...list])
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Paperclip className="size-4 text-muted-foreground" aria-hidden />
        {title}
        {(attached.length > 0 || (pending?.length ?? 0) > 0) && (
          <span className="text-xs font-normal text-muted-foreground">({attached.length + (pending?.length ?? 0)})</span>
        )}
        {(upload.isPending || isLoading) && <Spinner />}
      </div>
      {attached.map((f) => (
        <FileChip
          key={f.id}
          file={f}
          onRemove={async () => {
            if (await confirm({ title: `Delete ${f.name}?`, description: 'The file is removed from storage permanently.', confirmLabel: 'Delete', destructive: true }))
              remove.mutate(f)
          }}
        />
      ))}
      {pending?.map((f, i) => (
        <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-dashed border-border px-2.5 py-2 text-sm">
          <FileTypeIcon file={{ mime_type: f.type, name: f.name }} className="text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          <span className="text-xs text-muted-foreground">Uploads on save · {formatBytes(f.size)}</span>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${f.name}`} onClick={() => onPendingChange?.(pending.filter((_, j) => j !== i))}>
            <X />
          </Button>
        </div>
      ))}
      <DropZone compact onFiles={onFiles} disabled={upload.isPending} />
      {ownerId && attached.length > 0 && <p className="text-xs text-muted-foreground">Last added {relative(attached[0]!.created_at)}</p>}
    </section>
  )
}
