import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, LogOut, Monitor, Moon, Palette, Sun, User } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Field, Input, PasswordInput } from '@/components/ui/input'
import { Card, CardBody, CardHeader, Skeleton } from '@/components/ui/misc'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/auth'
import { useTheme, type Theme } from '@/providers/theme'
import { useProfile, useUpdateProfile } from './api'

const profileSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(120),
  institution: z.string().trim().max(160),
  program: z.string().trim().max(160),
  graduation_year: z.string().refine((v) => v === '' || (/^\d{4}$/.test(v) && +v >= 1990 && +v <= 2100), 'Enter a year like 2027'),
})
type ProfileValues = z.infer<typeof profileSchema>

const passwordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters').max(72).regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()
  const { theme, setTheme } = useTheme()

  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { full_name: '', institution: '', program: '', graduation_year: '' } })
  useEffect(() => {
    if (profile)
      form.reset({
        full_name: profile.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? '',
        institution: profile.institution ?? '',
        program: profile.program ?? '',
        graduation_year: profile.graduation_year?.toString() ?? '',
      })
  }, [profile, user, form])

  const pw = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) })

  const saveProfile = form.handleSubmit(async (v) => {
    await updateProfile
      .mutateAsync({ full_name: v.full_name, institution: v.institution || null, program: v.program || null, graduation_year: v.graduation_year ? Number(v.graduation_year) : null })
      .catch(() => undefined)
  })

  const changePassword = pw.handleSubmit(async ({ password }) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return toast.error(errorMessage(error))
    toast.success('Password updated')
    pw.reset({ password: '', confirm: '' })
  })

  const themes: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Your profile, appearance and account." />
      <div className="space-y-5">
        <Card>
          <CardHeader icon={<User />} title="Profile" description={user?.email} />
          <CardBody>
            {isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <form onSubmit={saveProfile} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="p-name" error={form.formState.errors.full_name?.message}>
                    <Input id="p-name" autoComplete="name" {...form.register('full_name')} />
                  </Field>
                  <Field label="Institution" htmlFor="p-inst">
                    <Input id="p-inst" placeholder="Your college or university" {...form.register('institution')} />
                  </Field>
                  <Field label="Program" htmlFor="p-prog">
                    <Input id="p-prog" placeholder="B.Tech Computer Science" {...form.register('program')} />
                  </Field>
                  <Field label="Graduation year" htmlFor="p-year" error={form.formState.errors.graduation_year?.message}>
                    <Input id="p-year" inputMode="numeric" placeholder="2027" {...form.register('graduation_year')} />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" loading={updateProfile.isPending} disabled={!form.formState.isDirty}>
                    Save profile
                  </Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Palette />} title="Appearance" />
          <CardBody>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
              {themes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={theme === value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors',
                    theme === value ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:bg-accent',
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<KeyRound />} title="Change password" />
          <CardBody>
            <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start" noValidate>
              <Field label="New password" htmlFor="pw-new" error={pw.formState.errors.password?.message}>
                <PasswordInput id="pw-new" autoComplete="new-password" {...pw.register('password')} />
              </Field>
              <Field label="Confirm" htmlFor="pw-confirm" error={pw.formState.errors.confirm?.message}>
                <PasswordInput id="pw-confirm" autoComplete="new-password" {...pw.register('confirm')} />
              </Field>
              <Button type="submit" className="sm:mt-6" loading={pw.formState.isSubmitting}>
                Update
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<LogOut />} title="Session" description="Your data stays saved in your account and syncs across devices." />
          <CardBody>
            <Button variant="outline" onClick={() => signOut()}>
              <LogOut /> Sign out
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
