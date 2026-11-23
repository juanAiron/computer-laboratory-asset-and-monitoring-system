import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

// Put your images in  frontend/public/login-bg/  (or wherever your static files are served)
const BACKGROUND_IMAGES = [
  '/login-bg/Devesse 1.jpg',
  '/login-bg/Devesse 2.jpg',
  '/login-bg/Gate 1.jpg',
  '/login-bg/Alley 3.jpg',
  '/login-bg/Alley 2.jpg',
  '/login-bg/Alley 1.jpg',
  '/login-bg/Rules 1.JPG',
  '/login-bg/Lab 1.JPG',
  '/login-bg/Lab 2.JPG',
  '/login-bg/Lab 3.JPG',
  '/login-bg/Lab 5.JPG',
  '/login-bg/Lab 7.JPG',
  '/login-bg/Lab 6.JPG',
  '/login-bg/Lab 9.JPG',
  '/login-bg/Code 1.JPG',
  '/login-bg/Lab 8.JPG',
]
const SLIDE_INTERVAL_MS = 6000

const PASSWORD_RULES = [
  { label: 'At least 10 characters', test: (value) => value.length >= 10 },
  { label: 'One uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'One number', test: (value) => /\d/.test(value) },
  { label: 'One symbol', test: (value) => /[!@#$%^&*(),.?":{}|<>_\-=+\[\]\\\/;'`~]/.test(value) },
]

function identifierValueIsValid(value) {
  const normalized = value.trim()
  return /^\d{7}$/.test(normalized) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
}

// Fine procedural grain overlay (no external image needed)
const GRAIN_STYLE = {
  backgroundImage:
    'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 180 180\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'.75\'/%3E%3C/svg%3E")',
  backgroundRepeat: 'repeat',
  backgroundSize: '180px 180px',
  mixBlendMode: 'soft-light',
  opacity: 0.28,
}

const FORM_GRAIN_STYLE = {
  ...GRAIN_STYLE,
  backgroundSize: '90px 90px',
  mixBlendMode: 'soft-light',
  opacity: 0.22,
}

function BackgroundSlideshow() {
  const [current, setCurrent] = useState(0)

  // Preload so fades never flash an unloaded image
  useEffect(() => {
    BACKGROUND_IMAGES.forEach((src) => {
      const img = new Image()
      img.src = src
    })
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((i) => (i + 1) % BACKGROUND_IMAGES.length)
    }, SLIDE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="absolute inset-y-0 left-0 w-full overflow-hidden bg-[#050d06] md:w-[58%] xl:w-[60%]" aria-hidden="true">
      {BACKGROUND_IMAGES.map((src, i) => (
        <div
          key={src}
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-[1500ms] ease-in-out ${
            i === current ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backgroundImage: `url("${src}")` }}
        />
      ))}

      {/* Dark green tint */}
      <div className="absolute inset-0 bg-[#06140a]/25" />

      {/* Darker green gradient: deepest on the left, easing toward the form side */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#030a04]/90 via-[#06140a]/40 to-transparent" />

      {/* Fine granular texture */}
      <div className="absolute inset-0" style={GRAIN_STYLE} />
    </div>
  )
}

export function LoginPage() {
  const { user, loginWithGoogle, loginLocal, signupLocal, forgotPassword, resetPassword } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [resetToken, setResetToken] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPasswordRules, setShowPasswordRules] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('reset_token')
    if (token) {
      setResetToken(token)
      setMode('reset')
      setError('')
    }
  }, [])

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

  async function handleForgotPassword(e) {
    e.preventDefault()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setSubmitting(true)
    try {
      const message = await forgotPassword(email)
      setError(message)
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to process password reset request.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!PASSWORD_RULES.every((rule) => rule.test(password))) {
      setShowPasswordRules(true)
      setError('Password must contain 10 characters, uppercase, lowercase, number, and symbol.')
      return
    }
    setShowPasswordRules(false)
    setSubmitting(true)
    try {
      await resetPassword(resetToken, password, confirmPassword)
      setPassword('')
      setConfirmPassword('')
      setResetToken('')
      setMode('login')
      window.history.replaceState({}, '', '/login')
      setError('Password reset successfully. You can now log in.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset link is invalid or has expired.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLocalSubmit(e) {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    if (mode === 'signup') {
      const normalizedName = fullName.trim().replace(/\s+/g, ' ')
      if (normalizedName.length < 2 || normalizedName.length > 100) {
        setFieldErrors({ fullName: 'Full name must be between 2 and 100 characters.' })
        setError('Full name must be between 2 and 100 characters.')
        return
      }
      if ((normalizedName.match(/[A-Za-z]/g) || []).length < 2 || /\d/.test(normalizedName)) {
        setFieldErrors({ fullName: 'Enter a valid full name without numbers.' })
        setError('Enter a valid full name without numbers.')
        return
      }
      if (!/^\d{7}$/.test(idNumber.trim())) {
        setFieldErrors({ idNumber: 'Student ID number must be exactly 7 digits.' })
        setError('Student ID number must be exactly 7 digits.')
        return
      }
      if (password !== confirmPassword) {
        setFieldErrors({ confirmPassword: 'Passwords do not match.' })
        setError('Passwords do not match.')
        return
      }
      if (!PASSWORD_RULES.every((rule) => rule.test(password))) {
        setShowPasswordRules(true)
        setFieldErrors({ password: 'Password does not meet all requirements.' })
        setError('Password must contain 10 characters, uppercase, lowercase, number, and symbol.')
        return
      }
    } else if (!identifierValueIsValid(email)) {
      setFieldErrors({ identifier: 'Enter a valid 7-digit ID number or email address.' })
      setError('Enter a valid 7-digit ID number or email address.')
      return
    } else if (!password) {
      setFieldErrors({ password: 'Please enter your password.' })
      setError('Please enter your password.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'signup') {
        await signupLocal(idNumber, password, confirmPassword, fullName)
      } else {
        if (!identifierValueIsValid(email)) {
          setError('Enter a valid 7-digit ID number or email address.')
          setSubmitting(false)
          return
        }
        await loginLocal(email, password)
      }
      navigate('/', { replace: true })
    } catch (err) {
      const message = err.response?.data?.detail || 'Invalid credentials.'
      setError('')
      if (mode === 'login') {
        const lowerMessage = message.toLowerCase()
        if (
          lowerMessage.includes('not registered')
          || lowerMessage.includes('no account')
          || lowerMessage.includes('id number')
        ) {
          setFieldErrors({ identifier: message })
        } else if (lowerMessage.includes('password') || lowerMessage.includes('credentials')) {
          setFieldErrors({ password: message })
        } else if (lowerMessage.includes('inactive')) {
          setFieldErrors({ identifier: message })
        } else {
          setFieldErrors({
            identifier: message,
            password: message,
          })
        }
      } else {
        setFieldErrors({ idNumber: message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen min-h-[100dvh] justify-end overflow-x-hidden">
      <BackgroundSlideshow />

      <div className="relative z-10 flex min-h-screen min-h-[100dvh] w-full items-start justify-center overflow-y-auto bg-cornsilk px-5 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-10 sm:pt-12 md:w-[42%] md:px-8 md:pt-12 lg:px-12 lg:pt-16 xl:w-[40%] xl:px-16 xl:pt-20">
        <div className="pointer-events-none absolute inset-0" style={FORM_GRAIN_STYLE} aria-hidden="true" />
        <div className="relative z-10 w-full max-w-[25rem] sm:max-w-md">
          <div className="mb-8 w-full sm:mb-10 lg:mb-12">
            <p className="font-slu-brand text-sm font-normal uppercase leading-tight text-evergreen sm:text-base lg:text-lg xl:text-xl">
              Saint Louis University
            </p>
            <h1 className="mt-1 whitespace-nowrap text-[clamp(2rem,10vw,3.25rem)] font-bold uppercase leading-none text-evergreen lg:text-[clamp(2.5rem,4vw,3.25rem)]">
              CIS TRIL Portal
            </h1>
            <p className="mt-2 text-right font-montserrat text-xs font-medium uppercase tracking-wide text-hunter-green sm:text-sm lg:text-base">
              Asset Management System
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {mode === 'forgot' || mode === 'reset' ? (
            <div key={mode} className="login-mode-enter">
              {mode === 'forgot' ? (
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <p className="text-sm text-hunter-green">
                    Enter your account email to request password reset instructions.
                  </p>
                  {mode === 'signup' ? (
                    <div>
                      <label className="block text-xs font-semibold text-evergreen">ID Number</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{7}"
                        maxLength={7}
                        required
                        value={idNumber}
                        onChange={(e) => {
                          setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 7))
                          setFieldErrors((current) => ({ ...current, idNumber: undefined }))
                        }}
                        placeholder="7-digit ID number"
                        className="mt-1 w-full rounded-lg border border-palm-leaf/50 bg-white px-3 py-2 text-sm text-evergreen focus:border-fern focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-evergreen">ID Number or Email</label>
                      <input
                        type="text"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          setFieldErrors((current) => ({ ...current, identifier: undefined }))
                        }}
                        placeholder="ID number or email"
                        className="mt-1 w-full rounded-lg border border-palm-leaf/50 bg-white px-3 py-2 text-sm text-evergreen focus:border-fern focus:outline-none"
                      />
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-hunter-green py-2.5 text-sm font-semibold text-cornsilk disabled:opacity-50"
                  >
                    {submitting ? 'Sending...' : 'Send Reset Instructions'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <p className="text-sm text-hunter-green">Create a new password for your account.</p>
                  <div>
                    <label className="block text-xs font-semibold text-evergreen">New Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          setFieldErrors((current) => ({ ...current, password: undefined }))
                        }}
                        className="mt-1 w-full rounded-lg border border-palm-leaf/50 bg-white px-3 py-2 pr-10 text-sm text-evergreen focus:border-fern focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-hunter-green"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-evergreen">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-palm-leaf/50 bg-white px-3 py-2 pr-10 text-sm text-evergreen focus:border-fern focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((visible) => !visible)}
                        className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-hunter-green"
                        aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                    {PASSWORD_RULES.map((rule) => (
                      <li
                        key={rule.label}
                        className={rule.test(password) ? 'text-fern' : 'text-red-700'}
                      >
                        {rule.test(password) ? '✓' : '•'} {rule.label}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-hunter-green py-2.5 text-sm font-semibold text-cornsilk disabled:opacity-50"
                  >
                    {submitting ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError('')
                  setPassword('')
                  setConfirmPassword('')
                }}
                className="mt-4 w-full text-sm font-semibold text-hunter-green underline-offset-2 hover:underline"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <>
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-evergreen/10 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError('')
                setShowPasswordRules(false)
                setFieldErrors({})
              }}
              className={`rounded-md py-2 text-sm font-semibold transition-colors ${
                mode === 'login'
                  ? 'bg-hunter-green text-cornsilk shadow-sm'
                  : 'text-evergreen hover:bg-evergreen/10'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError('')
                setShowPasswordRules(false)
                setFieldErrors({})
              }}
              className={`rounded-md py-2 text-sm font-semibold transition-colors ${
                mode === 'signup'
                  ? 'bg-hunter-green text-cornsilk shadow-sm'
                  : 'text-evergreen hover:bg-evergreen/10'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form key={mode} onSubmit={handleLocalSubmit} noValidate className="login-mode-enter space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-evergreen">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-evergreen focus:outline-none ${
                    fieldErrors.fullName
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-palm-leaf/50 focus:border-fern'
                  }`}
                />
                {fieldErrors.fullName && (
                  <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.fullName}</p>
                )}
              </div>
            )}
            {mode === 'signup' ? (
              <div>
                <label className="block text-xs font-semibold text-evergreen">ID Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{7}"
                  maxLength={7}
                  required
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 7))}
                  placeholder="7-digit ID number"
                  aria-invalid={Boolean(fieldErrors.idNumber)}
                  className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-evergreen focus:outline-none ${
                    fieldErrors.idNumber
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-palm-leaf/50 focus:border-fern'
                  }`}
                />
                {fieldErrors.idNumber && (
                  <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.idNumber}</p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-evergreen">ID Number or Email</label>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ID number or email"
                  aria-invalid={Boolean(fieldErrors.identifier)}
                  className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-evergreen focus:outline-none ${
                    fieldErrors.identifier
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-palm-leaf/50 focus:border-fern'
                  }`}
                />
                {fieldErrors.identifier && (
                  <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.identifier}</p>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-evergreen">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.password)}
                  className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm text-evergreen focus:outline-none ${
                    fieldErrors.password
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-palm-leaf/50 focus:border-fern'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-hunter-green"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.password}</p>
              )}
            </div>
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-evergreen">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm text-evergreen focus:outline-none ${
                      fieldErrors.confirmPassword
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-palm-leaf/50 focus:border-fern'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-hunter-green"
                    aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            )}
            {mode === 'signup' && (
              showPasswordRules &&
              PASSWORD_RULES.some((rule) => !rule.test(password)) && (
                <ul className="grid grid-cols-1 gap-1 text-xs text-red-700 sm:grid-cols-2">
                  {PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => (
                    <li key={rule.label}>• {rule.label}</li>
                  ))}
                </ul>
              )
            )}
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setMode('forgot')
                  setError('')
                }}
                className="ml-auto block text-xs font-semibold text-hunter-green underline-offset-2 hover:underline"
              >
                Forgot password?
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-hunter-green py-2.5 text-sm font-semibold text-cornsilk transition-colors hover:bg-evergreen disabled:opacity-50"
            >
              {submitting
                ? mode === 'signup'
                  ? 'Signing up...'
                  : 'Signing in...'
                : mode === 'signup'
                  ? 'Sign Up'
                  : 'Login'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-hunter-green">or</p>
          <div className="mt-4 flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Sign-In popup failed or was closed.')}
              hd="slu.edu.ph"
              theme="outline"
              size="large"
              width="320"
            />
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}