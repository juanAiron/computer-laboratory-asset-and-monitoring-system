import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { KeyRound, Monitor } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export function LoginPage() {
  const { user, loginWithGoogle, loginLocal } = useAuth()
  const navigate = useNavigate()

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
      setError(err.response?.data?.detail || 'Invalid staff credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-evergreen via-hunter-green to-fern px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-palm-leaf/30 bg-cornsilk p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-evergreen text-lime-cream shadow-md">
            <Monitor className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-evergreen">
            SLU Computer Laboratory System
          </h1>
          <p className="mt-1 text-sm text-hunter-green">
            Asset Management &amp; Live Workstation Monitoring
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Section 1: SLU Students, Instructors & Dept Heads */}
        <div className="flex flex-col items-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-hunter-green">
            Students &amp; Faculty (@slu.edu.ph)
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

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-palm-leaf/40" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-cornsilk px-2 font-semibold text-fern">
              TRIL Advisor &amp; Lab Custodians
            </span>
          </div>
        </div>

        {/* Section 2: Local Email & Password for Non-Google Staff */}
        <form onSubmit={handleLocalSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-evergreen">Staff Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="custodian1@tril-slu.local"
              className="mt-1 w-full rounded-lg border border-palm-leaf/50 bg-white px-3 py-2 text-sm text-evergreen focus:border-fern focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-evergreen">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-palm-leaf/50 bg-white px-3 py-2 text-sm text-evergreen focus:border-fern focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-hunter-green py-2.5 text-sm font-semibold text-cornsilk transition-colors hover:bg-evergreen disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4 text-lime-cream" />
            {submitting ? 'Signing in...' : 'Sign In with Staff Account'}
          </button>
        </form>
      </div>
    </div>
  )
}