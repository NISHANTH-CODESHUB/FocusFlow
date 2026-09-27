import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

export function percent(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Turns "a, b ,, c" into ["a","b","c"] (deduplicated, trimmed). */
export function splitList(value: string | undefined | null): string[] {
  if (!value) return []
  return [...new Set(value.split(',').map((s) => s.trim()).filter(Boolean))]
}

export function groupBy<T, K extends PropertyKey>(list: readonly T[], key: (item: T) => K): Partial<Record<K, T[]>> {
  const out: Partial<Record<K, T[]>> = {}
  for (const item of list) {
    const k = key(item)
    ;(out[k] ??= []).push(item)
  }
  return out
}

export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(-120)
  return cleaned || 'file'
}

export function initials(name: string | null | undefined, fallback = '?'): string {
  if (!name?.trim()) return fallback
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
