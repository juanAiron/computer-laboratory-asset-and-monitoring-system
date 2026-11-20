import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { Monitor, ShieldAlert } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export function LoginPage() {
  const { user, loginWithGoogle, loginLocal } = useAuth()
  const navigate = useNavigate()

  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError('')
    setSubmitting(true)
    try {
      await loginWithGoogle(credentialResponse.credential)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Google sign-in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLocalSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await loginLocal(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid administrator credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-900 text-amber-400">
            <Monitor className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            SLU Computer Laboratory System
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Asset Management &amp; Live Workstation Monitoring
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
            Sign in with your SLU Account
          </p>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google Sign-In popup failed or was closed.')}
            hd="slu.edu.ph"
            theme="outline"
            size="large"
            width="320"
          />
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <button
            type="button"
            onClick={() => setShowAdminLogin((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {showAdminLogin ? 'Hide Break-Glass Admin Login' : 'TRIL Admin Emergency Fallback'}
          </button>

          {showAdminLogin && (
            <form onSubmit={handleLocalSubmit} className="mt-4 space-y-3 text-left">
              <div>
                <label className="block text-xs font-medium text-slate-700">Admin Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tril.admin@slu.edu.ph"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? 'Signing in...' : 'Sign In as TRIL Admin'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}