import { GraduationCap, LogOut, Menu as MenuIcon, Monitor, Moon, Plus, Search, Settings, Sun, X } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { useItemEditor } from '@/features/items/editor'
import { useDisplayName } from '@/features/settings/api'
import { cn, initials } from '@/lib/utils'
import { useAuth } from '@/providers/auth'
import { useTheme, type Theme } from '@/providers/theme'
import { NAV, SETTINGS_NAV } from './nav'

const CommandPalette = lazy(() => import('./CommandPalette'))

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-2 font-semibold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <GraduationCap className="size-4.5" />
      </span>
      <span className={cn('text-[15px]', compact && 'max-[359px]:hidden')}>StudentOS</span>
    </Link>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {[...NAV, SETTINGS_NAV].map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              to === SETTINGS_NAV.to && 'mt-3',
            )
          }
        >
          <Icon className="size-4.5 shrink-0" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

function UserMenu() {
  const { user, signOut } = useAuth()
  const name = useDisplayName()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent" aria-label="Account menu">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">
            {initials(name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
          </span>
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-56">
        <MenuLabel>Theme</MenuLabel>
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <MenuItem key={value} icon={<Icon />} onSelect={() => setTheme(value)}>
            <span className="flex-1">{label}</span>
            {theme === value && <span className="size-1.5 rounded-full bg-primary" />}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem icon={<Settings />} onSelect={() => navigate('/settings')}>
          Settings
        </MenuItem>
        <MenuItem icon={<LogOut />} onSelect={() => signOut()}>
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

function ThemeToggle() {
  const { resolved, setTheme } = useTheme()
  return (
    <Button variant="ghost" size="icon" aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`} onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}>
      {resolved === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

export function AppShell() {
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const editor = useItemEditor()
  const location = useLocation()

  useEffect(() => setDrawer(false), [location.pathname])

  // Global shortcuts: ⌘/Ctrl+K search, N new item, / search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('[role="dialog"]')) return
      if (e.key === 'n') {
        e.preventDefault()
        editor.create()
      } else if (e.key === '/') {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor])

  return (
    <div className="min-h-dvh bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-3">
          <Brand />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-2">
          <NavLinks />
        </div>
        <div className="border-t border-border p-3">
          <UserMenu />
        </div>
      </aside>

      {/* Mobile drawer */}
      <D.Root open={drawer} onOpenChange={setDrawer}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-sidebar shadow-2xl outline-none lg:hidden">
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Description className="sr-only">Main navigation</D.Description>
            <div className="flex h-16 items-center justify-between px-3">
              <Brand />
              <D.Close className="rounded-md p-2 text-muted-foreground hover:bg-accent cursor-pointer" aria-label="Close menu">
                <X className="size-4" />
              </D.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <NavLinks onNavigate={() => setDrawer(false)} />
            </div>
            <div className="border-t border-border p-3">
              <UserMenu />
            </div>
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}>
            <MenuIcon />
          </Button>
          <div className="lg:hidden">
            <Brand compact />
          </div>
          <button
            onClick={() => setPalette(true)}
            className="ml-auto flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:text-foreground sm:w-72 lg:ml-0"
            aria-label="Search"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search everything…</span>
            <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 font-sans text-[10px] font-medium sm:inline">Ctrl K</kbd>
          </button>
          <div className="flex items-center gap-1 lg:ml-auto">
            <ThemeToggle />
            <Button onClick={() => editor.create()} className="hidden sm:inline-flex" title="New item (N)">
              <Plus /> New
            </Button>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile quick-add */}
      <Button
        onClick={() => editor.create()}
        size="icon"
        aria-label="New item"
        className="fixed right-5 bottom-5 z-30 size-14 rounded-full shadow-lg shadow-primary/30 sm:hidden [&_svg]:size-6"
      >
        <Plus />
      </Button>

      {palette && (
        <Suspense fallback={null}>
          <CommandPalette open={palette} onOpenChange={setPalette} />
        </Suspense>
      )}
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
