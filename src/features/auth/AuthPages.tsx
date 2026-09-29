import { zodResolver } from '@hookform/resolvers/zod'
import { BarChart3, CalendarRange, GraduationCap, MailCheck, Rocket } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, Input, PasswordInput } from '@/components/ui/input'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

const email = z.string().trim().min(1, 'Email is required').email('Enter a valid email')
const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number')

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5 text-lg font-semibold">
          <span className="grid size-9 place-items-center rounded-lg bg-white/15 ring-1 ring-white/25">
            <GraduationCap className="size-5" />
          </span>
          FocusFlow
        </div>
        <div className="my-auto max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">Your semester, career prep and projects — in one calm place.</h2>
          <ul className="mt-8 space-y-4 text-sm text-indigo-100">
            {[
              [CalendarRange, 'Plan tests, labs, assignments and deadlines on one calendar'],
              [GraduationCap, 'Break subjects into units and concepts and track mastery'],
              [Rocket, 'Track DSA, aptitude, certifications, internships and hackathons'],
              [BarChart3, 'See your productivity trends and export reports'],
            ].map(([Icon, text]) => {
              const I = Icon as typeof Rocket
              return (
                <li key={text as string} className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white/10">
                    <I className="size-4" />
                  </span>
                  <span className="pt-1">{text as string}</span>
                </li>
              )
            })}
          </ul>
        </div>
        <p className="text-xs text-indigo-200">Your data is private — only you can see it, on any device you sign in from.</p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-white/5" />
      </aside>
      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 font-semibold lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-4" />
            </span>
            FocusFlow
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  )
}

/* --------------------------------- Sign in -------------------------------- */

const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required') })

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) })
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) return setError(errorMessage(error))
    navigate(from, { replace: true })
  })

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your dashboard."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus aria-invalid={!!formState.errors.email} {...register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register('password')} />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={formState.isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}

/* --------------------------------- Sign up -------------------------------- */

const signupSchema = z
  .object({
    full_name: z.string().trim().min(1, 'Tell us your name').max(120),
    email,
    password,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })

export function SignupPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof signupSchema>>({ resolver: zodResolver(signupSchema) })
  const errors = formState.errors

  const onSubmit = handleSubmit(async ({ full_name, email, password }) => {
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name }, emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) return setError(errorMessage(error))
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities?.length === 0) return setError('An account with this email already exists. Try signing in.')
    if (data.session) {
      toast.success('Account created — welcome!')
      navigate('/', { replace: true })
    } else setSentTo(email)
  })

  if (sentTo) {
    return (
      <AuthLayout title="Check your inbox" subtitle={`We sent a confirmation link to ${sentTo}.`} footer={<Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          Open the link in the email to activate your account, then sign in. It can take a minute to arrive — check spam too.
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free, private, and synced across your devices."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="Full name" htmlFor="full_name" error={errors.full_name?.message}>
          <Input id="full_name" autoComplete="name" autoFocus aria-invalid={!!errors.full_name} {...register('full_name')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters with a letter and a number">
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register('confirm')} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={formState.isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}

/* ----------------------------- Forgot password ---------------------------- */

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email })) })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, { redirectTo: `${window.location.origin}/reset-password` })
    if (error) return setError(errorMessage(error))
    setSent(true)
  })

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={sent ? 'If an account exists for that email, a reset link is on its way.' : "Enter your email and we'll send you a reset link."}
      footer={<Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}
    >
      {!sent && (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormError message={error} />
          <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" autoFocus {...register('email')} />
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={formState.isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

/* ------------------------------ Reset password ---------------------------- */

const resetSchema = z.object({ password, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) })

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return setError(errorMessage(error))
    toast.success('Password updated')
    navigate('/', { replace: true })
  })

  return (
    <AuthLayout title="Choose a new password" subtitle="You're signed in via your reset link. Set a new password to continue.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="New password" htmlFor="password" error={formState.errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" autoFocus {...register('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={formState.errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" {...register('confirm')} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={formState.isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  )
}

/* ------------------------------ Setup required ---------------------------- */

export function SetupRequired() {
  return (
    <AuthLayout title="Connect Supabase" subtitle="FocusFlow needs a Supabase project for auth, database and file storage.">
      <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
        <li>Create a project at supabase.com (free tier works).</li>
        <li>
          In the SQL editor, run <code className="rounded bg-muted px-1 text-foreground">supabase/migrations/*.sql</code>.
        </li>
        <li>
          Copy <code className="rounded bg-muted px-1 text-foreground">.env.example</code> to <code className="rounded bg-muted px-1 text-foreground">.env.local</code> and fill in the project URL and anon key.
        </li>
        <li>Restart the dev server.</li>
        <li>
          Deployed (e.g. on Vercel)? Set <code className="rounded bg-muted px-1 text-foreground">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-muted px-1 text-foreground">VITE_SUPABASE_ANON_KEY</code> in the project's environment variables, then redeploy.
        </li>
      </ol>
    </AuthLayout>
  )
}
