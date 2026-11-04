import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AuthLayout } from './components/AuthLayout'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { WorkspacePage } from './pages/WorkspacePage'

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
 */
function Gate({ require, children }: { require: 'guest' | 'member'; children: ReactNode }) {
  const { session } = useAuth()
  const location = useLocation()
  if (session === null) return require === 'guest' ? children : <Splash />
  if (require === 'member' && !session.authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (require === 'guest' && session.authenticated) return <Navigate to="/workspace" replace />
  return children
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
            <Route path="/workspace" element={<Gate require="member"><WorkspacePage /></Gate>} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
