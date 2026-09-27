import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from './errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => count < 2 && !/permission|session/i.test(errorMessage(error)),
    },
    mutations: {
      onError: (error) => toast.error(errorMessage(error)),
    },
  },
})

export const queryKeys = {
  items: ['items'] as const,
  academics: ['academics'] as const,
  files: ['files'] as const,
  skills: ['skills'] as const,
  achievements: ['achievements'] as const,
  profile: ['profile'] as const,
}

const PAGE = 1000

/**
 * PostgREST caps responses (1000 rows by default), so page through everything.
 * `build` must return a fresh, deterministically ordered query for the range.
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}
