import { useCallback, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  error?: boolean
}

type Status = 'idle' | 'waiting' | 'streaming'

/** Friendly fallbacks when the server returns no JSON error body. */
function statusMessage(status: number): string {
  if (status === 401) return 'Please sign in again to use the assistant.'
  if (status === 404) return 'The assistant isn’t available on this server.'
  if (status === 429) return 'The free AI limit was reached for now. Wait a minute and try again.'
  if (status === 503) return 'The AI assistant isn’t set up yet.'
  return 'Something went wrong. Please try again.'
}

/** Chat state + streaming client for POST /api/chat. */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const abortRef = useRef<AbortController | null>(null)

  const update = (id: string, patch: (m: ChatMessage) => ChatMessage) => setMessages((list) => list.map((m) => (m.id === id ? patch(m) : m)))

  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || status !== 'idle') return
      const user: ChatMessage = { id: crypto.randomUUID(), role: 'user', content }
      const reply: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '' }
      // Failed replies aren't sent back as history.
      const history = [...messages.filter((m) => !m.error && m.content), user].map(({ role, content }) => ({ role, content }))
      setMessages((list) => [...list, user, reply])
      setStatus('waiting')

      const controller = new AbortController()
      abortRef.current = controller
      try {
        const { data } = await supabase.auth.getSession()
        const res = await fetch('/api/chat', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
          body: JSON.stringify({ messages: history, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        })
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          update(reply.id, (m) => ({ ...m, content: body?.error ?? statusMessage(res.status), error: true }))
          return
        }
        setStatus('streaming')
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          update(reply.id, (m) => ({ ...m, content: m.content + chunk }))
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          update(reply.id, (m) => ({ ...m, content: m.content ? `${m.content}\n\n_(stopped)_` : '_(stopped)_' }))
        } else {
          update(reply.id, (m) => ({ ...m, content: 'Couldn’t reach the assistant. Check your connection and try again.', error: true }))
        }
      } finally {
        abortRef.current = null
        setStatus('idle')
      }
    },
    [messages, status],
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])
  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
  }, [])

  return { messages, status, send, stop, reset }
}
