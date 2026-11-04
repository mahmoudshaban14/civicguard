import { useState, useEffect, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { getTranslation, type Language } from './i18n'
import {
  User as UserIcon,
  Shield,
  SlidersHorizontal,
  Bell,
  Lock,
  Sun,
  Moon,
  Monitor,
  CheckCircle,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import './Settings.css'

type Profile = {
  id: string
  role: string
  full_name?: string | null
  display_name?: string | null
  department?: string | null
}

type SettingsTab = 'profile' | 'security' | 'preferences' | 'notifications' | 'privacy'
type Theme = 'light' | 'dark' | 'system'

interface SettingsProps {
  user: User
  profile: Profile
  language: Language
  onLanguageChange: (lang: Language) => void
  onSignOut: () => Promise<boolean>
  onProfileUpdate?: (updated: Partial<Profile>) => void
}

function formatRoleLabel(role: string, language: Language): string {
  const roleMap: Record<string, { en: string; ar: string }> = {
    admin: {
      en: getTranslation(language, 'settingsRoleAdmin'),
      ar: getTranslation(language, 'settingsRoleAdmin'),
    },
    department_manager: {
      en: getTranslation(language, 'settingsRoleDepartmentManager'),
      ar: getTranslation(language, 'settingsRoleDepartmentManager'),
    },
    employee: {
      en: getTranslation(language, 'settingsRoleEmployee'),
      ar: getTranslation(language, 'settingsRoleEmployee'),
    },
    citizen: {
      en: getTranslation(language, 'settingsRoleCitizen'),
      ar: getTranslation(language, 'settingsRoleCitizen'),
    },
  }
  return roleMap[role]?.[language] ?? getTranslation(language, 'settingsRoleUnknown')
}

function getInitials(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email
  const parts = source.split(/[\s@]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function getThemeFromStorage(): Theme {
  const stored = localStorage.getItem('civicguard-theme')
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  return 'system'
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

export default function Settings({
  user,
  profile,
  language,
  onLanguageChange,
  onSignOut,
  onProfileUpdate,
}: SettingsProps) {
  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(language, key)
  const isRTL = language === 'ar'

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // ── Profile tab ────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(
    profile.display_name || profile.full_name || ''
  )
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  // ── Security tab ───────────────────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  // ── Preferences tab ────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<Theme>(getThemeFromStorage)

  // ── Notifications tab ──────────────────────────────────────────────────────
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('civicguard-notifications') !== 'disabled'
  })

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('civicguard-theme', theme)
  }, [theme])

  // System theme media query listener
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  // Clear messages when switching tabs
  useEffect(() => {
    setProfileSuccess('')
    setProfileError('')
    setPasswordSuccess('')
    setPasswordError('')
    setMobileNavOpen(false)
  }, [activeTab])

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileSuccess('')
    setProfileError('')

    const trimmed = displayName.trim()
    if (trimmed.length < 2) {
      setProfileError(t('settingsNameTooShort'))
      return
    }

    const currentName = profile.display_name || profile.full_name || ''
    if (trimmed === currentName) {
      setProfileSuccess(t('settingsNameUnchanged'))
      return
    }

    setProfileSaving(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', user.id)
        .select('id, role, full_name, display_name')

      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('No profile was updated. Check database permissions.')
      }

      onProfileUpdate?.(data[0])
      setProfileSuccess(t('settingsProfileSaved'))
    } catch (err) {
      setProfileError(
        (err as Error).message || (language === 'ar' ? 'تعذّر تحديث الملف الشخصي.' : 'Unable to update profile.')
      )
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordSuccess('')
    setPasswordError('')

    if (newPassword.length < 8) {
      setPasswordError(t('settingsPasswordTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('settingsPasswordsDoNotMatch'))
      return
    }

    setPasswordSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSuccess(t('settingsPasswordUpdated'))
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(
        (err as Error).message || (language === 'ar' ? 'تعذّر تحديث كلمة المرور.' : 'Unable to update password.')
      )
    } finally {
      setPasswordSaving(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    setSignOutError('')

    try {
      const success = await onSignOut()
      if (!success) {
        setSignOutError(t('settingsSignOutError'))
      }
    } catch {
      setSignOutError(t('settingsSignOutError'))
    } finally {
      setSigningOut(false)
    }
  }

  function handleLanguageChange(lang: Language) {
    onLanguageChange(lang)
  }

  function handleThemeChange(next: Theme) {
    setTheme(next)
  }

  function handleNotificationToggle() {
    const next = !notificationsEnabled
    setNotificationsEnabled(next)
    localStorage.setItem('civicguard-notifications', next ? 'enabled' : 'disabled')
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function formatDate(isoString: string | null | undefined): string {
    if (!isoString) return t('notAvailable')
    try {
      return new Date(isoString).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return t('notAvailable')
    }
  }

  const displayedName = profile.display_name || profile.full_name || ''
  const initials = getInitials(displayedName, user.email ?? '')
  const showDepartment = (profile.role === 'department_manager' || profile.role === 'employee') && profile.department

  // ── Nav items ──────────────────────────────────────────────────────────────

  const navItems: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: t('settingsProfile'), icon: <UserIcon size={17} strokeWidth={1.9} /> },
    { id: 'security', label: t('settingsSecurity'), icon: <Shield size={17} strokeWidth={1.9} /> },
    { id: 'preferences', label: t('settingsPreferences'), icon: <SlidersHorizontal size={17} strokeWidth={1.9} /> },
    { id: 'notifications', label: t('settingsNotifications'), icon: <Bell size={17} strokeWidth={1.9} /> },
    { id: 'privacy', label: t('settingsPrivacy'), icon: <Lock size={17} strokeWidth={1.9} /> },
  ]

  const activeNavItem = navItems.find((item) => item.id === activeTab)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="settings-page" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Page header */}
      <div className="settings-page-header">
        <div className="settings-page-header-inner">
          <div className="settings-header-eyebrow">
            {language === 'ar' ? 'إدارة الحساب' : 'ACCOUNT MANAGEMENT'}
          </div>
          <h2 className="settings-page-title">{t('settings')}</h2>
          <p className="settings-page-subtitle">{t('settingsSubtitle')}</p>
        </div>
      </div>

      {/* Layout */}
      <div className="settings-layout">
        {/* Mobile nav toggle */}
        <button
          type="button"
          className="settings-mobile-nav-toggle"
          onClick={() => setMobileNavOpen((prev) => !prev)}
          aria-expanded={mobileNavOpen}
        >
          <span className="settings-mobile-nav-icon">{activeNavItem?.icon}</span>
          <span>{activeNavItem?.label}</span>
          <ChevronRight
            size={16}
            className={`settings-mobile-chevron ${mobileNavOpen ? 'open' : ''}`}
            aria-hidden="true"
          />
        </button>

        {/* Sidebar nav */}
        <nav className={`settings-nav ${mobileNavOpen ? 'mobile-open' : ''}`} aria-label={t('settings')}>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`settings-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              <span className="settings-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="settings-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Content panel */}
        <div className="settings-content">

          {/* ── PROFILE ─────────────────────────────────────────────────── */}
          {activeTab === 'profile' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <h3 className="settings-section-title">{t('settingsProfile')}</h3>
                <p className="settings-section-desc">{t('settingsProfileDesc')}</p>
              </div>

              {/* Avatar */}
              <div className="settings-avatar-row">
                <div className="settings-avatar" aria-label={t('settingsProfileImageFallback')}>
                  {initials}
                </div>
                <div className="settings-avatar-info">
                  <span className="settings-avatar-name">{displayedName || user.email}</span>
                  <span className="settings-avatar-email">{user.email}</span>
                </div>
              </div>

              {/* Edit name form */}
              <form className="settings-form" onSubmit={handleSaveProfile} noValidate>
                <div className="settings-field">
                  <label className="settings-label" htmlFor="settings-display-name">
                    {t('settingsFullName')}
                  </label>
                  <input
                    id="settings-display-name"
                    type="text"
                    className="settings-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                    maxLength={80}
                    disabled={profileSaving}
                  />
                </div>

                <div className="settings-field">
                  <label className="settings-label" htmlFor="settings-email">
                    {t('settingsEmailAddress')}
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    className="settings-input settings-input-readonly"
                    value={user.email ?? ''}
                    readOnly
                    aria-readonly="true"
                  />
                  <p className="settings-hint">
                    {language === 'ar'
                      ? 'تغيير البريد الإلكتروني يتطلب التحقق عبر رابط مرسل إلى البريد الحالي.'
                      : 'Email changes require verification via a link sent to your current address.'}
                  </p>
                </div>

                <div className="settings-fields-row">
                  <div className="settings-field">
                    <label className="settings-label">{t('settingsRole')}</label>
                    <div className="settings-readonly-badge settings-role-badge">
                      {formatRoleLabel(profile.role, language)}
                    </div>
                  </div>

                  {showDepartment && (
                    <div className="settings-field">
                      <label className="settings-label">{t('settingsDepartment')}</label>
                      <div className="settings-readonly-badge">
                        {profile.department}
                      </div>
                    </div>
                  )}
                </div>

                <div className="settings-field">
                  <label className="settings-label">{t('settingsAccountCreated')}</label>
                  <div className="settings-readonly-text">{formatDate(user.created_at)}</div>
                </div>

                {profileSuccess && (
                  <div className="settings-alert settings-alert-success" role="status">
                    <CheckCircle size={16} aria-hidden="true" />
                    {profileSuccess}
                  </div>
                )}
                {profileError && (
                  <div className="settings-alert settings-alert-error" role="alert">
                    <AlertCircle size={16} aria-hidden="true" />
                    {profileError}
                  </div>
                )}

                <div className="settings-form-actions">
                  <button
                    type="submit"
                    className="settings-btn-primary"
                    disabled={profileSaving}
                  >
                    {profileSaving ? t('settingsSaving') : t('settingsSaveProfile')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── SECURITY ────────────────────────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <h3 className="settings-section-title">{t('settingsSecurity')}</h3>
                <p className="settings-section-desc">{t('settingsSecurityDesc')}</p>
              </div>

              {/* Change password */}
              <div className="settings-card">
                <h4 className="settings-card-title">{t('settingsChangePassword')}</h4>

                <form className="settings-form" onSubmit={handleChangePassword} noValidate>
                  <div className="settings-field">
                    <label className="settings-label" htmlFor="settings-new-password">
                      {t('settingsNewPassword')}
                    </label>
                    <input
                      id="settings-new-password"
                      type="password"
                      className="settings-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      disabled={passwordSaving}
                    />
                  </div>

                  <div className="settings-field">
                    <label className="settings-label" htmlFor="settings-confirm-password">
                      {t('settingsConfirmPassword')}
                    </label>
                    <input
                      id="settings-confirm-password"
                      type="password"
                      className="settings-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      disabled={passwordSaving}
                    />
                    <p className="settings-hint">{t('settingsPasswordRequirements')}</p>
                  </div>

                  {passwordSuccess && (
                    <div className="settings-alert settings-alert-success" role="status">
                      <CheckCircle size={16} aria-hidden="true" />
                      {passwordSuccess}
                    </div>
                  )}
                  {passwordError && (
                    <div className="settings-alert settings-alert-error" role="alert">
                      <AlertCircle size={16} aria-hidden="true" />
                      {passwordError}
                    </div>
                  )}

                  <div className="settings-form-actions">
                    <button
                      type="submit"
                      className="settings-btn-primary"
                      disabled={passwordSaving || !newPassword || !confirmPassword}
                    >
                      {passwordSaving ? t('settingsUpdatingPassword') : t('settingsUpdatePassword')}
                    </button>
                  </div>
                </form>
              </div>

              {/* Sign out */}
              <div className="settings-card settings-card-danger">
                <h4 className="settings-card-title">
                  {language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
                </h4>
                <p className="settings-card-desc">
                  {language === 'ar'
                    ? 'تسجيل الخروج من حسابك على هذا الجهاز.'
                    : 'Sign out of your account on this device.'}
                </p>
                {signOutError && (
                  <div className="settings-alert settings-alert-error" role="alert">
                    <AlertCircle size={16} aria-hidden="true" />
                    {signOutError}
                  </div>
                )}
                <button
                  type="button"
                  className="settings-btn-danger"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                >
                  {signingOut ? t('settingsSigningOut') : t('settingsSignOut')}
                </button>
              </div>
            </div>
          )}

          {/* ── PREFERENCES ─────────────────────────────────────────────── */}
          {activeTab === 'preferences' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <h3 className="settings-section-title">{t('settingsPreferences')}</h3>
                <p className="settings-section-desc">{t('settingsPreferencesDesc')}</p>
              </div>

              {/* Language */}
              <div className="settings-card">
                <h4 className="settings-card-title">{t('settingsLanguage')}</h4>
                <p className="settings-card-desc">{t('settingsLanguageDesc')}</p>
                <div className="settings-option-group">
                  <button
                    type="button"
                    className={`settings-option-btn ${language === 'en' ? 'selected' : ''}`}
                    onClick={() => handleLanguageChange('en')}
                  >
                    {language === 'ar' ? 'English' : 'English'}
                  </button>
                  <button
                    type="button"
                    className={`settings-option-btn ${language === 'ar' ? 'selected' : ''}`}
                    onClick={() => handleLanguageChange('ar')}
                  >
                    العربية
                  </button>
                </div>
              </div>

              {/* Appearance / Theme */}
              <div className="settings-card">
                <h4 className="settings-card-title">{t('settingsAppearance')}</h4>
                <p className="settings-card-desc">{t('settingsAppearanceDesc')}</p>
                <div className="settings-theme-group">
                  <button
                    type="button"
                    className={`settings-theme-btn ${theme === 'light' ? 'selected' : ''}`}
                    onClick={() => handleThemeChange('light')}
                    aria-pressed={theme === 'light'}
                  >
                    <Sun size={20} strokeWidth={1.8} aria-hidden="true" />
                    <span>{t('settingsThemeLight')}</span>
                  </button>
                  <button
                    type="button"
                    className={`settings-theme-btn ${theme === 'dark' ? 'selected' : ''}`}
                    onClick={() => handleThemeChange('dark')}
                    aria-pressed={theme === 'dark'}
                  >
                    <Moon size={20} strokeWidth={1.8} aria-hidden="true" />
                    <span>{t('settingsThemeDark')}</span>
                  </button>
                  <button
                    type="button"
                    className={`settings-theme-btn ${theme === 'system' ? 'selected' : ''}`}
                    onClick={() => handleThemeChange('system')}
                    aria-pressed={theme === 'system'}
                  >
                    <Monitor size={20} strokeWidth={1.8} aria-hidden="true" />
                    <span>{t('settingsThemeSystem')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ────────────────────────────────────────────── */}
          {activeTab === 'notifications' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <h3 className="settings-section-title">{t('settingsNotifications')}</h3>
                <p className="settings-section-desc">{t('settingsNotificationsDesc')}</p>
              </div>

              <div className="settings-card">
                <div className="settings-toggle-row">
                  <div className="settings-toggle-info">
                    <span className="settings-toggle-label">{t('settingsEnableNotifications')}</span>
                    <span className="settings-toggle-desc">{t('settingsEnableNotificationsDesc')}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notificationsEnabled}
                    className={`settings-toggle ${notificationsEnabled ? 'on' : ''}`}
                    onClick={handleNotificationToggle}
                  >
                    <span className="settings-toggle-thumb" />
                    <span className="sr-only">
                      {notificationsEnabled ? (language === 'ar' ? 'مفعّل' : 'Enabled') : (language === 'ar' ? 'معطّل' : 'Disabled')}
                    </span>
                  </button>
                </div>

                <div className="settings-notice settings-notice-info">
                  <AlertCircle size={15} aria-hidden="true" />
                  <span>{t('settingsNotificationsNotice')}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── PRIVACY & SESSIONS ───────────────────────────────────────── */}
          {activeTab === 'privacy' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <h3 className="settings-section-title">{t('settingsPrivacy')}</h3>
                <p className="settings-section-desc">{t('settingsPrivacyDesc')}</p>
              </div>

              {/* Account details */}
              <div className="settings-card">
                <h4 className="settings-card-title">
                  {language === 'ar' ? 'تفاصيل الحساب' : 'Account details'}
                </h4>

                <div className="settings-meta-list">
                  <div className="settings-meta-row">
                    <span className="settings-meta-label">{t('settingsLastSignIn')}</span>
                    <span className="settings-meta-value">{formatDate(user.last_sign_in_at)}</span>
                  </div>
                  <div className="settings-meta-row">
                    <span className="settings-meta-label">{t('settingsAccountCreated')}</span>
                    <span className="settings-meta-value">{formatDate(user.created_at)}</span>
                  </div>
                  <div className="settings-meta-row">
                    <span className="settings-meta-label">{t('settingsAccountId')}</span>
                    <span className="settings-meta-value settings-account-id">
                      {user.id.slice(0, 8)}…
                    </span>
                  </div>
                </div>
              </div>

              {/* Active sessions */}
              <div className="settings-card">
                <h4 className="settings-card-title">{t('settingsActiveSessions')}</h4>
                <div className="settings-notice settings-notice-info">
                  <AlertCircle size={15} aria-hidden="true" />
                  <span>{t('settingsActiveSessionsNotice')}</span>
                </div>
                <button
                  type="button"
                  className="settings-btn-secondary"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                >
                  {signingOut ? t('settingsSigningOut') : t('settingsSignOut')}
                </button>
              </div>

              {/* Account deletion */}
              <div className="settings-card settings-card-danger">
                <h4 className="settings-card-title">{t('settingsAccountDeletion')}</h4>
                <div className="settings-notice settings-notice-warning">
                  <AlertCircle size={15} aria-hidden="true" />
                  <span>{t('settingsAccountDeletionNotice')}</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </section>
  )
}
