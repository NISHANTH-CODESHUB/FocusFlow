import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Item } from '@/types/database'
import type { ItemFormValues } from './schema'

const ItemFormDialog = lazy(() => import('./ItemFormDialog'))

type EditorState = { mode: 'create'; defaults?: Partial<ItemFormValues> } | { mode: 'edit'; item: Item } | null

interface ItemEditor {
  create: (defaults?: Partial<ItemFormValues>) => void
  edit: (item: Item) => void
}

const EditorContext = createContext<ItemEditor | null>(null)

/** App-wide create/edit dialog for planner items, reachable from any screen. */
export function ItemEditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EditorState>(null)
  // Remount the form per open so stale values never leak between items.
  const [session, setSession] = useState(0)

  const create = useCallback((defaults?: Partial<ItemFormValues>) => {
    setSession((s) => s + 1)
    setState({ mode: 'create', defaults })
  }, [])
  const edit = useCallback((item: Item) => {
    setSession((s) => s + 1)
    setState({ mode: 'edit', item })
  }, [])
  const value = useMemo(() => ({ create, edit }), [create, edit])

  return (
    <EditorContext.Provider value={value}>
      {children}
      {state && (
        <Suspense fallback={null}>
          <ItemFormDialog key={session} state={state} onClose={() => setState(null)} />
        </Suspense>
      )}
    </EditorContext.Provider>
  )
}

export function useItemEditor(): ItemEditor {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useItemEditor must be used inside ItemEditorProvider')
  return ctx
}

export type { EditorState }
