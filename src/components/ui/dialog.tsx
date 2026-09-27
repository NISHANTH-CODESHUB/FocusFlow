import { X } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Prevent closing on outside click (e.g. while a form is dirty). */
  modal?: boolean
  className?: string
}

const sizes = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }

/**
 * Centered modal on desktop, full-width sheet anchored to the bottom on phones.
 * Header and footer stay fixed; the body scrolls.
 */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', className }: DialogProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in" />
        <D.Content
          className={cn(
            'fixed z-50 flex max-h-[92dvh] w-full flex-col border border-border bg-card text-card-foreground shadow-2xl outline-none',
            'inset-x-0 bottom-0 rounded-t-2xl',
            'sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:max-h-[88dvh] sm:rounded-2xl sm:data-[state=open]:animate-pop sm:-translate-x-1/2 sm:-translate-y-1/2',
            sizes[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <D.Title className="text-base font-semibold leading-tight">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</D.Description>
              )}
            </div>
            <D.Close className="-m-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer">
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </D.Close>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
              {footer}
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
