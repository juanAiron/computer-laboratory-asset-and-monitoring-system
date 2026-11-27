import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  Info,
  LockKeyhole,
  Palette,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { normalizeLanguage, useTranslation } from '../../utils/i18n'
import { ROLE_LABELS, ROLES } from '../../utils/roles'
import { getThemePreference } from '../../utils/theme'

const TABS = [
  { id: 'personal', label: 'Personal Info', icon: UserRound },
  { id: 'security', label: 'Account & Security', icon: LockKeyhole },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'preferences', label: 'Preferences', icon: Palette },
  { id: 'privacy', label: 'Privacy', icon: ShieldCheck },
]

export function ProfilePage() {
  const { user, updateProfile, updateProfilePhoto, logout } = useAuth()
  const { t } = useTranslation()
  const fileInputRef = useRef(null)
  const [activeTab, setActiveTab] = useState('personal')
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [courseYear, setCourseYear] = useState(user?.course_year || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [compactView, setCompactView] = useState(() => localStorage.getItem('profile_compact_view') === 'true')
  const [emailUpdates, setEmailUpdates] = useState(() => localStorage.getItem('profile_email_updates') !== 'false')
  const [saving, setSaving] = useState(false)
  const [toasts, setToasts] = useState([])
  const [toastVisible, setToastVisible] = useState(false)
  const [personalTouched, setPersonalTouched] = useState(false)
  const [securityTouched, setSecurityTouched] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState(null)
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState('')
  const [savedCompactView, setSavedCompactView] = useState(compactView)
  const [savedEmailUpdates, setSavedEmailUpdates] = useState(emailUpdates)
  const [department, setDepartment] = useState(user?.department || '')
  const [office, setOffice] = useState(user?.office || '')
  const [profileVisibility, setProfileVisibility] = useState(user?.profile_visibility || 'members')
  const [activityVisibility, setActivityVisibility] = useState(user?.activity_visibility || 'members')
  const [theme, setTheme] = useState(getThemePreference)
  const [language, setLanguage] = useState(() => normalizeLanguage(localStorage.getItem('profile_language') || 'English'))
  const [defaultView, setDefaultView] = useState(() => localStorage.getItem('profile_default_view') || 'dashboard')
  const [savedTheme, setSavedTheme] = useState(theme)
  const [savedLanguage, setSavedLanguage] = useState(language)
  const [savedDefaultView, setSavedDefaultView] = useState(defaultView)
  const [notificationSettings, setNotificationSettings] = useState(() => {
    const saved = localStorage.getItem('profile_notifications')
    return saved ? JSON.parse(saved) : {
      dueDates: true,
      overdue: true,
      repairs: true,
      inventory: true,
    }
  })
  const [savedNotificationSettings, setSavedNotificationSettings] = useState(notificationSettings)

  useEffect(() => {
    return () => {
      if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview)
    }
  }, [pendingPhotoPreview])

  useEffect(() => {
    const root = document.documentElement
    const resolved = savedTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : savedTheme
    root.dataset.theme = resolved
  }, [savedTheme])

  useEffect(() => {
    if (!toasts.length) return
    setToastVisible(true)
    const timeout = window.setTimeout(() => {
      setToastVisible(false)
      window.setTimeout(() => setToasts([]), 180)
    }, 5000)
    return () => window.clearTimeout(timeout)
  }, [toasts])

  const notify = (type, title, detail) => {
    setToastVisible(false)
    window.setTimeout(() => {
      setToasts([{ id: `${Date.now()}-${Math.random()}`, type, title, detail }])
      setToastVisible(true)
    }, 180)
  }

  const dismissToast = (id) => {
    setToastVisible(false)
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 180)
  }

  const inputStateClass = (state) => {
    if (state === 'success') return 'border border-fern ring-1 ring-fern/20 focus:border-fern'
    if (state === 'error') return 'border border-red-600 ring-1 ring-red-100 focus:border-red-600'
    return 'border border-palm-leaf/50 focus:border-fern'
  }

  const fullNameValid = fullName.trim().length >= 2 && /[A-Za-z]/.test(fullName)
  const isStudent = user?.role === ROLES.STUDENT
  const strongPassword =
    newPassword.length >= 10 &&
    /[A-Z]/.test(newPassword) &&
    /[a-z]/.test(newPassword) &&
    /\d/.test(newPassword)
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword
  const personalDirty =
    fullName !== (user?.full_name || '') ||
    Boolean(pendingPhoto) ||
    department !== (user?.department || '') ||
    office !== (user?.office || '')
  const securityDirty = Boolean(currentPassword || newPassword || confirmPassword)
  const preferencesDirty =
    compactView !== savedCompactView ||
    emailUpdates !== savedEmailUpdates ||
    theme !== savedTheme ||
    language !== savedLanguage ||
    defaultView !== savedDefaultView
  const notificationsDirty =
    JSON.stringify(notificationSettings) !== JSON.stringify(savedNotificationSettings)
  const privacyDirty =
    profileVisibility !== (user?.profile_visibility || 'members') ||
    activityVisibility !== (user?.activity_visibility || 'members')
  const hasUnsavedChanges = personalDirty || securityDirty || preferencesDirty || notificationsDirty || privacyDirty

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    window.__profileDirty = hasUnsavedChanges
    return () => {
      window.__profileDirty = false
    }
  }, [hasUnsavedChanges])

  const savePersonalInfo = async (event) => {
    event.preventDefault()
    if (!personalDirty) return
    setPersonalTouched(true)
    if (!fullNameValid) {
      notify('error', 'Error!', 'Enter a valid display name.')
      return
    }
    setSaving(true)
    try {
      await updateProfile({
        full_name: fullName,
        course_year: courseYear,
        department,
        office,
        profile_visibility: profileVisibility,
        activity_visibility: activityVisibility,
      })
      if (pendingPhoto) await updateProfilePhoto(pendingPhoto)
      if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview)
      setPendingPhoto(null)
      setPendingPhotoPreview('')
      notify('success', 'Success!', 'Personal information was saved.')
    } catch (error) {
      notify('error', 'Error!', error.response?.data?.detail || 'Unable to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify('error', 'Error!', 'Choose a JPG, PNG, or WebP image.')
      event.target.value = ''
      return
    }
    if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview)
    setPendingPhoto(file)
    setPendingPhotoPreview(URL.createObjectURL(file))
    notify('info', 'Info', 'Photo selected. Press Save Changes to apply it.')
    event.target.value = ''
  }

  const changePassword = async (event) => {
    event.preventDefault()
    if (!securityDirty) return
    setSecurityTouched(true)
    if (!currentPassword) {
      notify('error', 'Error!', 'Enter your current password.')
      return
    }
    if (!strongPassword) {
      notify('warning', 'Warning', 'Use at least 10 characters with uppercase, lowercase, and a number.')
      return
    }
    if (!passwordsMatch) {
      notify('error', 'Error!', 'The new passwords do not match.')
      return
    }
    setSaving(true)
    try {
      await api.post('/users/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      notify('success', 'Success!', 'Password changed successfully.')
    } catch (error) {
      notify('error', 'Error!', error.response?.data?.detail || 'Unable to change password.')
    } finally {
      setSaving(false)
    }
  }

  const savePreferences = (compact, email) => {
    if (!preferencesDirty) return
    localStorage.setItem('profile_compact_view', String(compact))
    localStorage.setItem('profile_email_updates', String(email))
    localStorage.setItem('profile_theme', theme)
    localStorage.setItem('profile_language', language)
    window.dispatchEvent(new Event('app-language-change'))
    localStorage.setItem('profile_default_view', defaultView)
    setSavedCompactView(compact)
    setSavedEmailUpdates(email)
    setSavedTheme(theme)
    setSavedLanguage(language)
    setSavedDefaultView(defaultView)
    notify('success', 'Success!', 'Preferences saved.')
  }

  const initials = (user?.full_name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <div className="mx-auto max-w-5xl">
      <div
        className={`fixed left-1/2 top-16 z-[80] flex w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2 transition-all duration-[180ms] ${
          toastVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const styles = {
            success: 'border-emerald-700 bg-emerald-700 text-white',
            error: 'border-red-700 bg-red-700 text-white',
            warning: 'border-amber-400 bg-amber-50 text-amber-950',
            info: 'border-sky-400 bg-sky-50 text-sky-950',
          }[toast.type]
          const Icon =
            toast.type === 'success' ? CheckCircle2 :
            toast.type === 'error' ? AlertCircle :
            toast.type === 'warning' ? AlertTriangle :
            Info
          return (
            <div key={toast.id} className={`flex items-start gap-3 rounded-lg border-l-4 px-4 py-3 shadow-lg ${styles}`}>
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{t(toast.title)}</p>
                <p className="mt-0.5 text-xs opacity-90">{t(toast.detail)}</p>
              </div>
              <button type="button" onClick={() => dismissToast(toast.id)} className="rounded p-0.5 opacity-70 hover:opacity-100" aria-label={t('Dismiss')}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-palm-leaf/30 bg-white p-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id)
                if (id === 'security') {
                  notify('warning', 'Warning', 'Changing your password will end active sessions on other devices.')
                }
                if (id === 'preferences') {
                  notify('info', 'Info', 'Preference changes are saved on this device.')
                }
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold ${
                activeTab === id ? 'bg-hunter-green text-cornsilk' : 'text-evergreen hover:bg-cornsilk/60'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(label)}
            </button>
          ))}
        </aside>

        <section className="rounded-xl border border-palm-leaf/30 bg-white p-5 md:p-6">
          {activeTab === 'personal' && (
            <form onSubmit={savePersonalInfo}>
              <h2 className="text-lg font-bold text-evergreen">{t('Personal Info')}</h2>
              <div className="mt-5 flex items-center gap-5">
                {pendingPhotoPreview || user?.profile_photo_url ? (
                  <img
                    src={pendingPhotoPreview || user.profile_photo_url}
                    alt={user?.full_name || t('Profile')}
                    className="h-24 w-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-hunter-green text-2xl font-bold text-cornsilk">
                    {initials}
                  </div>
                )}
                <div>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg border border-palm-leaf/50 px-3 py-2 text-sm font-semibold text-evergreen hover:bg-cornsilk/60"
                  >
                    <Camera className="h-4 w-4" />
                    {t('Change photo')}
                  </button>
                  <p className="mt-2 text-xs text-hunter-green">{t('JPG, PNG, or WebP')}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-evergreen">{t('Display Name')}</label>
                  <input
                    value={fullName}
                    onChange={(event) => {
                      setFullName(event.target.value)
                      setPersonalTouched(true)
                    }}
                    aria-invalid={personalTouched && !fullNameValid}
                    className={`mt-1 w-full rounded-lg px-3 py-2 text-sm text-evergreen focus:outline-none ${inputStateClass(
                      personalTouched ? (fullNameValid ? 'success' : 'error') : 'neutral'
                    )}`}
                  />
                  {personalTouched && (
                    <p className={`mt-1 text-xs ${fullNameValid ? 'text-fern' : 'text-red-700'}`}>
                      {t(fullNameValid ? 'Display name looks good.' : 'Enter at least 2 characters.')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-evergreen">{t('ID Number')}</label>
                  <input
                    value={user?.id_number || t('Not assigned')}
                    disabled
                    className="mt-1 w-full cursor-not-allowed rounded-lg border border-palm-leaf/30 bg-cornsilk/60 px-3 py-2 text-sm text-hunter-green opacity-70"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-evergreen">{t('Email')}</label>
                  <input
                    value={user?.email || ''}
                    disabled
                    className="mt-1 w-full cursor-not-allowed rounded-lg border border-palm-leaf/30 bg-cornsilk/60 px-3 py-2 text-sm text-hunter-green opacity-70"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-evergreen">
                    {t(isStudent ? 'Course / Year' : 'Role')}
                  </label>
                  {isStudent ? (
                    <input
                      value={courseYear}
                      disabled
                      className="mt-1 w-full cursor-not-allowed rounded-lg border border-palm-leaf/30 bg-cornsilk/60 px-3 py-2 text-sm text-hunter-green opacity-70"
                    />
                  ) : (
                    <input
                      value={t(ROLE_LABELS[user?.role] || user?.role || '')}
                      disabled
                      className="mt-1 w-full cursor-not-allowed rounded-lg border border-palm-leaf/30 bg-cornsilk/60 px-3 py-2 text-sm text-hunter-green opacity-70"
                    />
                  )}
                </div>
                {!isStudent && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-evergreen">{t('Department')}</label>
                      <input
                        value={department}
                        onChange={(event) => setDepartment(event.target.value)}
                        placeholder={t('Example: Computer Science')}
                        className="mt-1 w-full rounded-lg border border-palm-leaf/50 px-3 py-2 text-sm text-evergreen focus:border-fern focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-evergreen">{t('Office')}</label>
                      <input
                        value={office}
                        onChange={(event) => setOffice(event.target.value)}
                        placeholder={t('Example: TRIL Laboratory')}
                        className="mt-1 w-full rounded-lg border border-palm-leaf/50 px-3 py-2 text-sm text-evergreen focus:border-fern focus:outline-none"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !personalDirty}
                  className="flex items-center gap-2 rounded-lg bg-hunter-green px-4 py-2.5 text-sm font-semibold text-cornsilk disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {t('Save changes')}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={changePassword}>
              <h2 className="text-lg font-bold text-evergreen">{t('Account & Security')}</h2>
              <div className="mt-5 max-w-md space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-evergreen">{t('Current Password')}</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => {
                      setCurrentPassword(event.target.value)
                      setSecurityTouched(true)
                    }}
                    required
                    aria-invalid={securityTouched && !currentPassword}
                    className={`mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none ${inputStateClass(
                      securityTouched ? (currentPassword ? 'success' : 'error') : 'neutral'
                    )}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-evergreen">{t('New Password')}</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value)
                      setSecurityTouched(true)
                    }}
                    required
                    aria-invalid={securityTouched && newPassword && !strongPassword}
                    className={`mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none ${inputStateClass(
                      newPassword ? (strongPassword ? 'success' : 'error') : 'neutral'
                    )}`}
                  />
                  {newPassword && (
                    <p className={`mt-1 text-xs ${strongPassword ? 'text-fern' : 'text-red-700'}`}>
                      {t(strongPassword ? 'Strong password.' : 'Use 10+ characters, uppercase, lowercase, and a number.')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-evergreen">{t('Confirm New Password')}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value)
                      setSecurityTouched(true)
                    }}
                    required
                    aria-invalid={securityTouched && confirmPassword && !passwordsMatch}
                    className={`mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none ${inputStateClass(
                      confirmPassword ? (passwordsMatch ? 'success' : 'error') : 'neutral'
                    )}`}
                  />
                  {confirmPassword && (
                    <p className={`mt-1 text-xs ${passwordsMatch ? 'text-fern' : 'text-red-700'}`}>
                      {t(passwordsMatch ? 'Passwords match.' : 'Passwords do not match.')}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !securityDirty}
                  className="rounded-lg bg-hunter-green px-4 py-2.5 text-sm font-semibold text-cornsilk disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('Change password')}
                </button>
              </div>
              <div className="mt-6 border-t border-palm-leaf/30 pt-5">
                <h3 className="text-sm font-bold text-evergreen">{t('Active Sessions')}</h3>
                <div className="mt-3 flex items-center justify-between rounded-lg border border-palm-leaf/30 p-4">
                  <div>
                    <p className="text-sm font-semibold text-evergreen">{t('Current browser session')}</p>
                    <p className="mt-0.5 text-xs text-hunter-green">{t('Active now')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('Sign out of this account on all devices?'))) logout()
                    }}
                    className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    {t('Sign out all devices')}
                  </button>
                </div>
              </div>
            </form>
          )}

          {activeTab === 'preferences' && (
            <div>
              <h2 className="text-lg font-bold text-evergreen">{t('Preferences')}</h2>
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-evergreen">{t('Theme')}</label>
                    <select value={theme} onChange={(event) => setTheme(event.target.value)} className="mt-1 w-full rounded-lg border border-palm-leaf/50 px-3 py-2 text-sm text-evergreen">
                      <option value="light">{t('Light')}</option>
                      <option value="dark">{t('Dark')}</option>
                      <option value="system">{t('System')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-evergreen">{t('Language')}</label>
                    <select value={language} onChange={(event) => setLanguage(event.target.value)} className="mt-1 w-full rounded-lg border border-palm-leaf/50 px-3 py-2 text-sm text-evergreen">
                      <option value="English">{t('English')}</option>
                      <option value="Tagalog">{t('Tagalog')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-evergreen">{t('Default View')}</label>
                    <select value={defaultView} onChange={(event) => setDefaultView(event.target.value)} className="mt-1 w-full rounded-lg border border-palm-leaf/50 px-3 py-2 text-sm text-evergreen">
                      <option value="dashboard">{t('Dashboard')}</option>
                      <option value="labs">{t('Computer Labs')}</option>
                      <option value="borrowed">{t('Borrowed')}</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center justify-between rounded-lg border border-palm-leaf/30 p-4">
                  <span>
                    <span className="block text-sm font-semibold text-evergreen">{t('Compact View')}</span>
                    <span className="text-xs text-hunter-green">{t('Use tighter spacing across dashboard cards.')}</span>
                  </span>
                  <input type="checkbox" checked={compactView} onChange={(event) => setCompactView(event.target.checked)} />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-palm-leaf/30 p-4">
                  <span>
                    <span className="block text-sm font-semibold text-evergreen">{t('Email Updates')}</span>
                    <span className="text-xs text-hunter-green">{t('Receive account and laboratory notifications.')}</span>
                  </span>
                  <input type="checkbox" checked={emailUpdates} onChange={(event) => setEmailUpdates(event.target.checked)} />
                </label>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => savePreferences(compactView, emailUpdates)}
                  disabled={!preferencesDirty}
                  className="flex items-center gap-2 rounded-lg bg-hunter-green px-4 py-2.5 text-sm font-semibold text-cornsilk disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {t('Save preferences')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-lg font-bold text-evergreen">{t('Notification Settings')}</h2>
              <div className="mt-5 space-y-3">
                {[
                  ['dueDates', 'Borrow Due Dates', 'Remind you before borrowed equipment is due.'],
                  ['overdue', 'Overdue Borrows', 'Alert you when borrowed equipment becomes overdue.'],
                  ['repairs', 'Repair Ticket Updates', 'Receive updates for laboratory repair tickets.'],
                  ['inventory', 'Inventory Alerts', 'Receive low-stock and inventory audit alerts.'],
                ].map(([key, label, description]) => (
                  <label key={key} className="flex items-center justify-between rounded-lg border border-palm-leaf/30 p-4">
                    <span>
                      <span className="block text-sm font-semibold text-evergreen">{t(label)}</span>
                      <span className="text-xs text-hunter-green">{t(description)}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={notificationSettings[key]}
                      onChange={(event) => setNotificationSettings((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={!notificationsDirty}
                  onClick={() => {
                    localStorage.setItem('profile_notifications', JSON.stringify(notificationSettings))
                    setSavedNotificationSettings(notificationSettings)
                    notify('success', 'Success!', 'Notification preferences saved.')
                  }}
                  className="flex items-center gap-2 rounded-lg bg-hunter-green px-4 py-2.5 text-sm font-semibold text-cornsilk disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {t('Save notifications')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div>
              <h2 className="text-lg font-bold text-evergreen">{t('Privacy')}</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-evergreen">{t('Profile Visibility')}</label>
                  <select
                    value={profileVisibility}
                    onChange={(event) => setProfileVisibility(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-palm-leaf/50 px-3 py-2 text-sm text-evergreen"
                  >
                    <option value="private">{t('Private')}</option>
                    <option value="members">{t('System Members')}</option>
                    <option value="public">{t('Public')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-evergreen">{t('Activity Visibility')}</label>
                  <select
                    value={activityVisibility}
                    onChange={(event) => setActivityVisibility(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-palm-leaf/50 px-3 py-2 text-sm text-evergreen"
                  >
                    <option value="private">{t('Private')}</option>
                    <option value="members">{t('System Members')}</option>
                  </select>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={!privacyDirty}
                  onClick={async () => {
                    try {
                      await updateProfile({
                        full_name: fullName,
                        course_year: courseYear,
                        department,
                        office,
                        profile_visibility: profileVisibility,
                        activity_visibility: activityVisibility,
                      })
                      notify('success', 'Success!', 'Privacy settings saved.')
                    } catch (error) {
                      notify('error', 'Error!', error.response?.data?.detail || 'Unable to save privacy settings.')
                    }
                  }}
                  className="flex items-center gap-2 rounded-lg bg-hunter-green px-4 py-2.5 text-sm font-semibold text-cornsilk disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {t('Save privacy')}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
