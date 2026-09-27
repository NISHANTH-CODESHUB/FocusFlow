import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { fetchAll, queryKeys } from '@/lib/query'
import { requireUserId, STORAGE_BUCKET, supabase } from '@/lib/supabase'
import { sanitizeFileName } from '@/lib/utils'
import type { FileFolder, FileRecord, TablesUpdate } from '@/types/database'

export const MAX_FILE_BYTES = 50 * 1024 * 1024

export const ACCEPTED_FILES =
  '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp,.gif,.svg,.zip,.rar,.7z,.ipynb,.py,.java,.c,.cpp,.js,.ts,.json'

export interface FileLinks {
  subject_id?: string | null
  unit_id?: string | null
  concept_id?: string | null
  item_id?: string | null
}

export interface UploadInput extends FileLinks {
  file: File
  folder: FileFolder
  description?: string
  tags?: string[]
}

async function fetchFiles(): Promise<FileRecord[]> {
  return fetchAll<FileRecord>((f, t) =>
    supabase.from('files').select('*').order('created_at', { ascending: false }).order('id').range(f, t),
  )
}

export function useFiles() {
  return useQuery({ queryKey: queryKeys.files, queryFn: fetchFiles })
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 50 MB`
  if (file.size === 0) return `${file.name} is empty`
  return null
}

/**
 * Uploads bytes to Storage under "<uid>/<folder>/<uuid>-<name>", then records
 * metadata. If the metadata insert fails the orphaned object is removed.
 */
export async function uploadFile(input: UploadInput): Promise<FileRecord> {
  const problem = validateFile(input.file)
  if (problem) throw new Error(problem)
  const userId = await requireUserId()
  const path = `${userId}/${input.folder}/${crypto.randomUUID()}-${sanitizeFileName(input.file.name)}`

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, input.file, {
    contentType: input.file.type || 'application/octet-stream',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('files')
    .insert({
      name: input.file.name.slice(0, 255),
      storage_path: path,
      mime_type: input.file.type || null,
      size_bytes: input.file.size,
      folder: input.folder,
      description: input.description?.trim() || null,
      tags: input.tags ?? [],
      subject_id: input.subject_id ?? null,
      unit_id: input.unit_id ?? null,
      concept_id: input.concept_id ?? null,
      item_id: input.item_id ?? null,
    })
    .select()
    .single()
  if (error) {
    await supabase.storage.from(STORAGE_BUCKET).remove([path])
    throw error
  }
  return data
}

export function useUploadFiles() {
  const qc = useQueryClient()
  return useMutation({
    /** Uploads sequentially and reports partial failures instead of failing the batch. */
    mutationFn: async (inputs: UploadInput[]) => {
      const uploaded: FileRecord[] = []
      const failed: string[] = []
      for (const input of inputs) {
        try {
          uploaded.push(await uploadFile(input))
        } catch (e) {
          failed.push(`${input.file.name}: ${errorMessage(e)}`)
        }
      }
      return { uploaded, failed }
    },
    onSuccess: ({ uploaded, failed }) => {
      if (uploaded.length) {
        qc.setQueryData<FileRecord[]>(queryKeys.files, (old) => [...uploaded, ...(old ?? [])])
        toast.success(uploaded.length === 1 ? `Uploaded ${uploaded[0]!.name}` : `Uploaded ${uploaded.length} files`)
      }
      for (const f of failed) toast.error(f)
    },
  })
}

export function useUpdateFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<'files'> }) => {
      const { data, error } = await supabase.from('files').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (file) => {
      qc.setQueryData<FileRecord[]>(queryKeys.files, (old) => old?.map((f) => (f.id === file.id ? file : f)))
      toast.success('File updated')
    },
  })
}

export function useDeleteFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: FileRecord) => {
      const { error } = await supabase.from('files').delete().eq('id', file.id)
      if (error) throw error
      // Metadata is gone, so the object is unreachable from the app either way;
      // a failed object removal is logged rather than surfaced as an error.
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove([file.storage_path])
      if (storageError) console.warn('Storage cleanup failed', storageError)
      return file.id
    },
    onSuccess: (id) => {
      qc.setQueryData<FileRecord[]>(queryKeys.files, (old) => old?.filter((f) => f.id !== id))
      toast.success('File deleted')
    },
  })
}

export async function signedUrl(file: Pick<FileRecord, 'storage_path' | 'name'>, download = false): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(file.storage_path, 60 * 10, download ? { download: file.name } : undefined)
  if (error) throw error
  return data.signedUrl
}

export async function openFile(file: FileRecord, download = false) {
  // Open the tab synchronously so pop-up blockers allow it, then point it at the signed URL.
  const tab = download ? null : window.open('', '_blank')
  try {
    const url = await signedUrl(file, download)
    if (tab) {
      tab.opener = null
      tab.location.href = url
    } else {
      const a = document.createElement('a')
      a.href = url
      a.rel = 'noopener'
      a.click()
    }
  } catch (e) {
    tab?.close()
    toast.error(errorMessage(e))
  }
}
