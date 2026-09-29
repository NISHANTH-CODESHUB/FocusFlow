import { ArrowUp, Loader2, RotateCcw, Sparkles, Square, X } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { useChat } from './useChat'

const SUGGESTIONS = [
  'What should I focus on today?',
  'What’s due this week?',
  'Make a study plan for my next test',
  'Which topics am I behind on?',
  'Explain a topic from my syllabus simply',
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  chat: ReturnType<typeof useChat>
}

export default function AssistantPanel({ open, onOpenChange, chat }: Props) {
  const { messages, status, send, stop, reset } = chat
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const busy = status !== 'idle'

  // Keep the newest text in view while streaming.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const submit = (text = draft) => {
    if (!text.trim() || busy) return
    void send(text)
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in sm:bg-black/20" />
        <D.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            inputRef.current?.focus()
          }}
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card shadow-2xl outline-none sm:max-w-md"
        >
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <D.Title className="text-sm font-semibold">FocusFlow AI</D.Title>
              <D.Description className="text-xs text-muted-foreground">Knows your tasks, deadlines and subjects</D.Description>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={reset} title="Start a new chat">
                <RotateCcw /> New
              </Button>
            )}
            <D.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close assistant">
                <X />
              </Button>
            </D.Close>
          </header>

          <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col justify-end gap-4 pb-2">
                <div>
                  <p className="text-base font-semibold">Hi! How can I help?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ask about your schedule, get a study plan, or have a topic explained. I can read your FocusFlow data but can’t change it.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="cursor-pointer rounded-xl border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary-soft/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground">{m.content}</p>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-2.5">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                      <Sparkles className="size-3.5" />
                    </span>
                    <div className={cn('min-w-0 flex-1 text-sm', m.error && 'text-destructive')}>
                      {m.content ? (
                        <div className="chat-md">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" /> }}>
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin" /> Thinking…
                        </span>
                      )}
                    </div>
                  </div>
                ),
              )
            )}
          </div>

          <footer className="border-t border-border p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-input bg-background p-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                rows={Math.min(Math.max(draft.split('\n').length, 1), 6)}
                maxLength={4000}
                placeholder="Ask anything about your studies…"
                aria-label="Message the assistant"
                className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              {busy ? (
                <Button size="icon" variant="secondary" onClick={stop} aria-label="Stop answering" className="rounded-xl">
                  <Square className="fill-current" />
                </Button>
              ) : (
                <Button size="icon" onClick={() => submit()} disabled={!draft.trim()} aria-label="Send" className="rounded-xl">
                  <ArrowUp />
                </Button>
              )}
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Free AI (Groq) · can make mistakes — double-check important dates.</p>
          </footer>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
