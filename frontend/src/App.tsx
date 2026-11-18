import { LoaderCircle } from 'lucide-react'
import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { homePathFor, isOrganizer, ORGANIZER_HOME } from './auth/roles'
import { AuthLayout } from './components/AuthLayout'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { WorkspacePage } from './pages/WorkspacePage'

// The Organizer Workspace loads as its own chunk, so the sign-in screens stay small.
const OrganizerLayout = lazy(() => import('./features/organizer').then((m) => ({ default: m.OrganizerLayout })))
const OverviewPage = lazy(() => import('./features/organizer').then((m) => ({ default: m.OverviewPage })))
const ModulePage = lazy(() => import('./features/organizer').then((m) => ({ default: m.ModulePage })))
const ActionCenterPage = lazy(() => import('./features/organizer').then((m) => ({ default: m.ActionCenterPage })))
const CompetitionsPage = lazy(() => import('./features/organizer').then((m) => ({ default: m.CompetitionsPage })))
const FixturesPage = lazy(() => import('./features/organizer').then((m) => ({ default: m.FixturesPage })))

function Splash() {
  return (
    <div className="splash" role="status">
      <LoaderCircle className="btn__spinner" size={28} aria-hidden="true" />
      <span className="visually-hidden">Loading</span>
    </div>
  )
}

/**
 * Admits only matching visitors once the initial session check resolves.
 * Guest screens (sign-in, registration) render immediately while the check runs,
 * so the card never swaps a loader for the form and shifts the layout; they
 * redirect only if the check finds an existing session.
 * `role="organizer"` additionally limits a member route to organizer sessions;
 * anyone else is sent to their own home.
 */
function Gate({ require, role, children }: { require: 'guest' | 'member'; role?: 'organizer'; children: ReactNode }) {
  const { session } = useAuth()
  const location = useLocation()
  if (session === null) return require === 'guest' ? children : <Splash />
  if (require === 'member' && !session.authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (require === 'guest' && session.authenticated) {
    // Signing in re-renders this gate before the sign-in page can navigate, so
    // honour a pending deep link here (the role check below guards it).
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? homePathFor(session)} replace />
  }
  if (role === 'organizer' && session.authenticated && !isOrganizer(session)) {
    return <Navigate to={homePathFor(session)} replace />
  }
  return children
}

/** /workspace: organizers have a dashboard; every other workspace keeps the summary page. */
function MemberHome() {
  const { session } = useAuth()
  if (session?.authenticated && isOrganizer(session)) return <Navigate to={ORGANIZER_HOME} replace />
  return <WorkspacePage />
}

function AuthFrame() {
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AuthFrame />}>
            <Route path="/login" element={<Gate require="guest"><LoginPage /></Gate>} />
            <Route path="/register" element={<Gate require="guest"><RegisterPage /></Gate>} />
            <Route path="/forgot-password" element={<Gate require="guest"><ForgotPasswordPage /></Gate>} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/workspace" element={<Gate require="member"><MemberHome /></Gate>} />
          </Route>
          <Route
            path="/organizer"
            element={
              <Gate require="member" role="organizer">
                <Suspense fallback={<Splash />}>
                  <OrganizerLayout />
                </Suspense>
              </Gate>
            }
          >
            <Route index element={<Navigate to={ORGANIZER_HOME} replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="action-center" element={<ActionCenterPage />} />
            <Route path="competitions" element={<CompetitionsPage />} />
            <Route path="fixtures" element={<FixturesPage />} />
            <Route path=":module" element={<ModulePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
