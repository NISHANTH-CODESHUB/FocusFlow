import { AlertDialog as A } from 'radix-ui'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Promise-based confirmation dialog: `if (await confirm({...})) doIt()` */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(value: boolean) => void>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <A.Root open={!!options} onOpenChange={(open) => !open && settle(false)}>
        <A.Portal>
          <A.Overlay className="fixed inset-0 z-[60] bg-black/40 data-[state=open]:animate-in" />
          <A.Content className="fixed top-1/2 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl data-[state=open]:animate-pop">
            <A.Title className="text-base font-semibold">{options?.title}</A.Title>
            <A.Description className="mt-2 text-sm text-muted-foreground">
              {options?.description ?? 'This action cannot be undone.'}
            </A.Description>
            <div className="mt-5 flex justify-end gap-2">
              <A.Cancel className={buttonVariants({ variant: 'outline' })}>Cancel</A.Cancel>
              <A.Action
                className={cn(buttonVariants({ variant: options?.destructive ? 'destructive' : 'default' }))}
                onClick={() => settle(true)}
              >
                {options?.confirmLabel ?? 'Confirm'}
              </A.Action>
            </div>
          </A.Content>
        </A.Portal>
      </A.Root>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}
