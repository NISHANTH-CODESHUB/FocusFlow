import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, type ReactNode } from 'react'
import { Compass } from 'lucide-react'
import { createBrowserRouter, Link, Navigate, Outlet, RouterProvider, useLocation, useRouteError } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { EmptyState, Spinner } from '@/components/ui/misc'
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SetupRequired, SignupPage } from '@/features/auth/AuthPages'
import { ItemEditorProvider } from '@/features/items/editor'
import { queryClient } from '@/lib/query'
import { isSupabaseConfigured } from '@/lib/supabase'
import { AuthProvider, useAuth } from '@/providers/auth'
import { ConfirmProvider } from '@/providers/confirm'
import { ThemeProvider, useTheme } from '@/providers/theme'

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const PlannerPage = lazy(() => import('@/features/planner/PlannerPage'))
const AcademicsPage = lazy(() => import('@/features/academics/AcademicsPage'))
const SubjectPage = lazy(() => import('@/features/academics/SubjectPage'))
const CareerPage = lazy(() => import('@/features/career/CareerPage'))
const StatsPage = lazy(() => import('@/features/stats/StatsPage'))
const FilesPage = lazy(() => import('@/features/files/FilesPage'))
const ExportPage = lazy(() => import('@/features/export/ExportPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))

function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner label="Loading FocusFlow" />
    </div>
  )
}

function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner />
    </div>
  )
}

/** Signed-in area: redirects to /login and remembers where the user was going. */
function RequireAuth() {
  const { session, loading, recovering } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (recovering && location.pathname !== '/reset-password') return <Navigate to="/reset-password" replace />
  return (
    <ItemEditorProvider>
      <AppShell />
    </ItemEditorProvider>
  )
}

function PublicOnly() {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}

function RecoveryOnly() {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/forgot-password" replace />
  return <ResetPasswordPage />
}

function RouteError() {
  const error = useRouteError() as { message?: string; status?: number } | undefined
  const chunkFailed = /dynamically imported module|Failed to fetch/i.test(error?.message ?? '')
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <p className="text-sm font-medium text-primary">{error?.status === 404 ? '404' : 'Error'}</p>
        <h1 className="mt-2 text-2xl font-semibold">{error?.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {chunkFailed ? 'A new version of the app is available. Reload to continue.' : (error?.message ?? 'An unexpected error occurred.')}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={() => window.location.assign('/')}>
            Go to dashboard
          </Button>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <EmptyState
      icon={<Compass />}
      title="Page not found"
      description="That page doesn't exist. It may have been moved or the link is mistyped."
      action={
        <Button asChild variant="outline">
          <Link to="/">Go to dashboard</Link>
        </Button>
      }
      className="mt-10"
    />
  )
}

const page = (node: ReactNode) => <Suspense fallback={<PageLoader />}>{node}</Suspense>

const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignupPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      { path: '/reset-password', element: <RecoveryOnly /> },
      {
        element: <RequireAuth />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: page(<DashboardPage />) },
          { path: '/planner', element: page(<PlannerPage />) },
          { path: '/academics', element: page(<AcademicsPage />) },
          { path: '/academics/:subjectId', element: page(<SubjectPage />) },
          { path: '/career', element: page(<CareerPage />) },
          { path: '/stats', element: page(<StatsPage />) },
          { path: '/files', element: page(<FilesPage />) },
          { path: '/export', element: page(<ExportPage />) },
          { path: '/settings', element: page(<SettingsPage />) },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])

function ThemedToaster() {
  const { resolved } = useTheme()
  return <Toaster theme={resolved} position="bottom-right" richColors closeButton />
}

export default function App() {
  return (
    <ThemeProvider>
      {isSupabaseConfigured ? (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ConfirmProvider>
              <RouterProvider router={router} />
            </ConfirmProvider>
          </AuthProvider>
        </QueryClientProvider>
      ) : (
        <SetupRequired />
      )}
      <ThemedToaster />
    </ThemeProvider>
  )
}
