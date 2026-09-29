import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground/70 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/20'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input ref={ref} type={type} className={cn(fieldBase, 'h-9 py-1', className)} {...props} />
  ),
)
Input.displayName = 'Input'

/** Password field with a show/hide toggle, so people can check what they typed. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(({ className, ...props }, ref) => {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input ref={ref} type={visible ? 'text' : 'password'} className={cn(fieldBase, 'h-9 py-1 pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(fieldBase, 'min-h-16 resize-y py-2 leading-relaxed', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

/** Native select: accessible, keyboard/touch friendly and consistent with the other fields. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className={cn('relative', className)}>
      <select ref={ref} className={cn(fieldBase, 'h-9 cursor-pointer appearance-none pr-8')} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
)
Select.displayName = 'Select'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-foreground', className)} {...props} />
}

interface FieldProps {
  label?: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn('size-4 cursor-pointer rounded border-input accent-primary', className)}
      {...props}
    />
  )
}
