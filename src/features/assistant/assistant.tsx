import { createContext, lazy, Suspense, useContext, useMemo, useState, type ReactNode } from 'react'
import { useChat } from './useChat'

const AssistantPanel = lazy(() => import('./AssistantPanel'))

interface AssistantState {
  open: () => void
}

const AssistantContext = createContext<AssistantState | null>(null)

/** Holds the chat for the whole session so closing the panel keeps the conversation. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const chat = useChat()
  const value = useMemo(
    () => ({
      open: () => {
        setMounted(true)
        setOpen(true)
      },
    }),
    [],
  )
  return (
    <AssistantContext.Provider value={value}>
      {children}
      {mounted && (
        <Suspense fallback={null}>
          <AssistantPanel open={isOpen} onOpenChange={setOpen} chat={chat} />
        </Suspense>
      )}
    </AssistantContext.Provider>
  )
}

export function useAssistant(): AssistantState {
  const ctx = useContext(AssistantContext)
  if (!ctx) throw new Error('useAssistant must be used inside AssistantProvider')
  return ctx
}
