
import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { adminApiClient } from './lib/api'
import './App.css'
import { LayoutDashboard, FileText, MapPinned, ShieldCheck, Bell, Check } from 'lucide-react'
import GISMap from './GISMap'
import { getTranslation, translateStatus, translateCategory, type Language } from './i18n'

type Profile = {
  id: string
  role: string
  full_name?: string | null
  display_name?: string | null
}

type Report = {
  id: string
  report_code: string
  category: string | null
  image_description: string | null
  status: string
  created_at: string
}
type NotificationItem = {
  id: string
  report_id: string | null
  type: string
  title: string
  body: string | null
  read: boolean
  created_at: string
}

function formatDashboardNumber(value: number, language: Language): string {
  return value.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', {
    useGrouping: false,
  })
}

function App() {
    const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem('civicguard-language')
    return savedLanguage === 'en' ? 'en' : 'ar'
  })
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [checkingProfile, setCheckingProfile] = useState(false)
  const [reports, setReports] = useState<Report[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState('')
  const [filter, setFilter] = useState('all')
  const [activePage, setActivePage] = useState<'overview' | 'reports' | 'gis' | 'notifications'>('overview')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false)
  // Close notification dropdown when navigating between pages
  useEffect(() => {
    setNotificationDropdownOpen(false)
  }, [activePage])

  useEffect(() => {
  localStorage.setItem('civicguard-language', language)
  document.documentElement.setAttribute('lang', language)
  document.documentElement.setAttribute(
    'dir',
    language === 'ar' ? 'rtl' : 'ltr'
  )
}, [language])
  // Restore the current Supabase session and listen for login/logout.
  useEffect(() => {
    let mounted = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
        setProfile(null)
        setReports([])
        setError('')
      }
    })

    async function restoreSession() {
      const { data, error: sessionError } =
        await supabase.auth.getSession()

      if (!mounted) return

      if (sessionError) {
        setError(sessionError.message)
      }

      setUser(data.session?.user ?? null)
      setCheckingSession(false)
    }

    void restoreSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Read the signed-in user's role from the profiles table.
  useEffect(() => {
    let mounted = true

    async function checkAdminRole() {
      if (!user) {
        setProfile(null)
        setCheckingProfile(false)
        return
      }

      setCheckingProfile(true)
      setError('')

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, full_name, display_name')
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return

      if (profileError) {
        setProfile(null)
        setError(
          `Could not verify your account role: ${profileError.message}`,
        )
        setCheckingProfile(false)
        return
      }

      const currentProfile = data as Profile | null

      if (!currentProfile || currentProfile.role !== 'admin') {
        setProfile(null)
        setError('Access denied. This account is not an administrator.')
        setCheckingProfile(false)
        await supabase.auth.signOut()
        return
      }

      setProfile(currentProfile)
      setCheckingProfile(false)
    }

    void checkAdminRole()

    return () => {
      mounted = false
    }
  }, [user])

  // Load reports from the Node.js API once admin role is confirmed
  async function loadReportsFromApi() {
    if (!user || profile?.role !== 'admin') return

    setReportsLoading(true)
    setReportsError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('No valid session token found')

      const res = await adminApiClient<{ reports: Report[] }>(
        '/v1/authority/reports?limit=1000',
        { token },
      )
      setReports(res.reports ?? [])
    } catch (err) {
      setReports([])
      setReportsError(
        `Reports could not be loaded: ${(err as Error).message}`,
      )
    } finally {
      setReportsLoading(false)
    }
  }

  useEffect(() => {
    if (!user || profile?.role !== 'admin') return

    void loadReportsFromApi()

    const channel = supabase
      .channel('app-reports-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReport = payload.new as Report
            setReports((current) => {
              if (current.some((r) => r.id === newReport.id)) return current
              return [newReport, ...current]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Report
            setReports((current) =>
              current.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
            )
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            setReports((current) => current.filter((r) => r.id !== deletedId))
          }
        },
      )
      .subscribe()

    const pollInterval = window.setInterval(() => {
      void loadReportsFromApi()
    }, 15000)

    return () => {
      void supabase.removeChannel(channel)
      window.clearInterval(pollInterval)
    }
  }, [user, profile])

  async function loadNotifications() {
    if (!user || profile?.role !== 'admin') return
    setNotificationsLoading(true)
    setNotificationsError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('No valid session token found')

      const result = await adminApiClient<{ notifications: NotificationItem[] }>(
        '/v1/notifications?limit=50&offset=0',
        { token },
      )
      setNotifications(result.notifications ?? [])
    } catch (err) {
      setNotificationsError((err as Error).message)
    } finally {
      setNotificationsLoading(false)
    }
  }

  async function markNotificationRead(id: string) {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('No valid session token found')

      await adminApiClient('/v1/notifications/read', {
        token,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
      setNotifications((items) =>
        items.map((item) => item.id === id ? { ...item, read: true } : item),
      )
    } catch (err) {
      setNotificationsError((err as Error).message)
    }
  }

  async function markAllNotificationsRead() {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('No valid session token found')

      await adminApiClient('/v1/notifications/read', {
        token,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setNotifications((items) => items.map((item) => ({ ...item, read: true })))
    } catch (err) {
      setNotificationsError((err as Error).message)
    }
  }

  useEffect(() => {
    if (user && profile?.role === 'admin') void loadNotifications()
  }, [user, profile])
  async function handleUpdateStatus(reportId: string, nextStatus: string) {
    setUpdatingId(reportId)
    setReportsError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('No valid session token found')

      const res = await adminApiClient<{ report: Report }>(
        `/v1/authority/reports/${reportId}/status`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            status: nextStatus,
            note: `Status updated to ${nextStatus} by administrator`,
          }),
        },
      )

      if (res.report) {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: res.report.status } : r)),
        )
      }
    } catch (err) {
      setReportsError(`Failed to update report status: ${(err as Error).message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

      if (signInError) {
        setError(signInError.message)
      }
    } catch {
      setError('An unexpected error occurred while signing in.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    setError('')

    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setError(`Could not sign out: ${signOutError.message}`)
    }
  }

  if (checkingSession || (user && checkingProfile)) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-icon">C</div>
          <h1>CivicGuard</h1>
          <p>{getTranslation(language, 'verifying')}</p>
        </section>
      </main>
    )
  }

  if (!user || profile?.role !== 'admin') {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-icon">C</div>
          <h1>{getTranslation(language, 'loginWelcome')}</h1>
          <p className="auth-description">
            {getTranslation(language, 'loginWelcomeDescription')}
          </p>

          <form onSubmit={handleSignIn}>
            <label htmlFor="email">{getTranslation(language, 'email')}</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="YourName@civicguard.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label htmlFor="password">{getTranslation(language, 'password')}</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder={language === 'ar' ? '\u0623\u062f\u062e\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631' : 'Enter your password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy}>
              {busy ? getTranslation(language, 'signingIn') : getTranslation(language, 'signIn')}
            </button>
          </form>

          <p className="auth-footer">{language === 'ar' ? '\u062f\u062e\u0648\u0644 \u0645\u0642\u064a\u062f \u0644\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0646 \u0627\u0644\u0645\u0635\u0631\u062d \u0644\u0647\u0645 \u0641\u0642\u0637' : 'Restricted access ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Authorized administrators only'}</p>
        </section>
      </main>
    )
  }

  const escapeCsv = (value: string) =>
    `"${value.replace(/"/g, '""')}"`

  function exportReportsCsv() {
    const headers = language === 'ar'
      ? ['Ã˜Â±Ã™â€šÃ™â€¦ Ã˜Â§Ã™â€žÃ˜Â¨Ã™â€žÃ˜Â§Ã˜Âº', 'Ã˜Â§Ã™â€žÃ™ÂÃ˜Â¦Ã˜Â©', 'Ã™Ë†Ã˜ÂµÃ™Â Ã˜Â§Ã™â€žÃ˜ÂµÃ™Ë†Ã˜Â±Ã˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â°Ã™Æ’Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â§Ã˜ÂµÃ˜Â·Ã™â€ Ã˜Â§Ã˜Â¹Ã™Å ', 'Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ˜Â©', 'Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â§Ã˜Â±Ã™Å Ã˜Â®']
      : ['Report ID', 'Category', 'AI Image Description', 'Status', 'Date']

    const rows = filteredReports.map((report) => [
      report.report_code,
      report.category
        ? translateCategory(report.category, language)
        : getTranslation(language, 'uncategorized'),
      report.image_description?.trim() || '',
      translateStatus(report.status, language),
      new Date(report.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB'),
    ])

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsv(String(value ?? ''))).join(','))
      .join('\r\n')

    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `civicguard-reports-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function printReports() {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert(language === 'ar'
        ? 'Ã™Å Ã˜Â±Ã˜Â¬Ã™â€° Ã˜Â§Ã™â€žÃ˜Â³Ã™â€¦Ã˜Â§Ã˜Â­ Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€ Ã™Ë†Ã˜Â§Ã™ÂÃ˜Â° Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¨Ã˜Â«Ã™â€šÃ˜Â© Ã™â€žÃ™â€žÃ˜Â·Ã˜Â¨Ã˜Â§Ã˜Â¹Ã˜Â©.'
        : 'Please allow pop-ups to print reports.')
      return
    }

    const headers = language === 'ar'
      ? ['Ã˜Â±Ã™â€šÃ™â€¦ Ã˜Â§Ã™â€žÃ˜Â¨Ã™â€žÃ˜Â§Ã˜Âº', 'Ã˜Â§Ã™â€žÃ™ÂÃ˜Â¦Ã˜Â©', 'Ã™Ë†Ã˜ÂµÃ™Â Ã˜Â§Ã™â€žÃ˜ÂµÃ™Ë†Ã˜Â±Ã˜Â©', 'Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ˜Â©', 'Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â§Ã˜Â±Ã™Å Ã˜Â®']
      : ['Report ID', 'Category', 'Image Description', 'Status', 'Date']

    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      })[char]!)

    const rows = filteredReports.map((report) => [
      report.report_code,
      report.category
        ? translateCategory(report.category, language)
        : getTranslation(language, 'uncategorized'),
      report.image_description?.trim() || 'Ã¢â‚¬â€',
      translateStatus(report.status, language),
      new Date(report.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB'),
    ])

    const tableRows = [headers, ...rows].map((row, index) =>
      `<tr>${row.map((cell) => index === 0
        ? `<th>${escapeHtml(String(cell ?? ''))}</th>`
        : `<td>${escapeHtml(String(cell ?? ''))}</td>`
      ).join('')}</tr>`
    ).join('')

    printWindow.document.write(`
      <!doctype html>
      <html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8">
        <title>${language === 'ar' ? 'Ã˜ÂªÃ™â€šÃ˜Â±Ã™Å Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¨Ã™â€žÃ˜Â§Ã˜ÂºÃ˜Â§Ã˜Âª' : 'CivicGuard Reports'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          h2 { margin-bottom: 18px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: start; }
          th { background: #eef2f7; }
          tr { break-inside: avoid; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h2>${language === 'ar' ? 'Ã˜ÂªÃ™â€šÃ˜Â±Ã™Å Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¨Ã™â€žÃ˜Â§Ã˜ÂºÃ˜Â§Ã˜Âª' : 'CivicGuard Reports'}</h2>
        <p>${language === 'ar' ? 'Ã˜Â¹Ã˜Â¯Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â¨Ã™â€žÃ˜Â§Ã˜ÂºÃ˜Â§Ã˜Âª:' : 'Total reports:'} ${filteredReports.length}</p>
        <table><thead>${tableRows.split('</tr>')[0]}</tr></thead>
        <tbody>${tableRows.split('</tr>').slice(1).join('</tr>')}</tbody></table>
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }
  const filteredReports =
    filter === 'all'
      ? reports
      : reports.filter((report) => report.status === filter)

  const countStatus = (status: string) =>
  reports.filter((report) => report.status === status).length

const resolvedCount = countStatus('resolved')

const resolvedRate =
  reports.length === 0
    ? 0
    : Math.round((resolvedCount / reports.length) * 100)

  return (
    <div className="dashboard" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">C</div>
          <div>
            <h2 className="sidebar-admin-name">{profile?.display_name || profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || getTranslation(language, 'administrator')}</h2>
            <p>{getTranslation(language, 'adminPortal')}</p>
          </div>
        </div>

        <p className="menu-label">{getTranslation(language, 'management')}</p>

        <nav className="navigation">
  <a
    href="#overview"
    className={`nav-link ${activePage === 'overview' ? 'active' : ''}`}
    onClick={(event) => {
      event.preventDefault()
      setActivePage('overview')
    }}
  >
    <LayoutDashboard size={18} strokeWidth={1.8} aria-hidden="true" /> {getTranslation(language, 'overview')}
  </a>

  <a
    href="#reports"
    className={`nav-link ${activePage === 'reports' ? 'active' : ''}`}
    onClick={(event) => {
      event.preventDefault()
      setActivePage('reports')
    }}
  >
    <FileText size={18} strokeWidth={1.8} aria-hidden="true" /> {getTranslation(language, 'reports')}
  </a>

  <a
    href="#gis"
    className={`nav-link ${activePage === 'gis' ? 'active' : ''}`}
    onClick={(event) => {
      event.preventDefault()
      setActivePage('gis')
    }}
  >
    <MapPinned size={18} strokeWidth={1.8} aria-hidden="true" /> {getTranslation(language, 'gisMap')}
  </a>
</nav>

        <div className="sidebar-bottom"><button type="button" className="sidebar-signout" onClick={handleSignOut}>{getTranslation(language, 'signOut')}</button></div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div></div>
          <div className="notification-menu-wrapper">
            <button
              type="button"
              className="notification-bell"
              aria-label={getTranslation(language, 'notifications')}
              aria-expanded={notificationDropdownOpen}
              onClick={() => {
                setNotificationDropdownOpen((open) => !open)
                if (!notificationDropdownOpen) void loadNotifications()
              }}
            >
              <Bell size={20} />
              {notifications.filter((item) => !item.read).length > 0 && (
                <span className="notification-badge">
                  {notifications.filter((item) => !item.read).length}
                </span>
              )}
            </button>

            {notificationDropdownOpen && (
              <div className="notification-dropdown">
                <div className="notification-dropdown-header">
                  <strong>{getTranslation(language, 'notificationCenter')}</strong>
                  <button
                    type="button"
                    className="notifications-mark-all"
                    onClick={() => void markAllNotificationsRead()}
                  >
                    {getTranslation(language, 'markAllAsRead')}
                  </button>
                </div>

                {notificationsError && (
                  <p className="notification-error">{notificationsError}</p>
                )}

                {notificationsLoading ? (
                  <p className="notification-empty">{getTranslation(language, 'loading')}</p>
                ) : notifications.length === 0 ? (
                  <p className="notification-empty">{getTranslation(language, 'noNotifications')}</p>
                ) : (
                  <div className="notification-dropdown-list">
                    {notifications.slice(0, 6).map((item) => (
                      <div key={item.id} className={`notification-item ${item.read ? '' : 'unread'}`}>
                        <div>
                          <strong>{item.title}</strong>
                          {item.body && <p>{item.body}</p>}
                          <small>
                            {new Date(item.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                          </small>
                        </div>
                        {!item.read && (
                          <button
                            type="button"
                            className="notification-mark-read"
                            aria-label={getTranslation(language, 'markAsRead')}
                            onClick={() => void markNotificationRead(item.id)}
                          >
                            <Check size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="view-all-notifications"
                  onClick={() => {
                    setNotificationDropdownOpen(false)
                    setActivePage('notifications')
                  }}
                >
                  {getTranslation(language, 'viewAllNotifications')}
                </button>
              </div>
            )}
          </div>

                    <button
            type="button"
            className="language-toggle"
            onClick={() =>
              setLanguage((current) => (current === 'ar' ? 'en' : 'ar'))
            }
          >
            {language === 'ar' ? 'English' : '\u0627\u0644\u0639\u0631\u0628\u064a\u0629'}
          </button>
        </header>

{activePage === 'overview' && (
  <>

        <section className="welcome">
          <div>
            <h2>{getTranslation(language, 'overview')}</h2>
            <p>
              {getTranslation(language, 'overviewDescription')}
            </p>
          </div>
          <div className="welcome-icon"><ShieldCheck size={36} strokeWidth={1.8} aria-hidden="true" /></div>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <p>{getTranslation(language, 'totalReports')}</p>
            <h3>{formatDashboardNumber(reports.length, language)}</h3>
          </article>

          <article className="stat-card">
            <p>{getTranslation(language, 'underReview')}</p>
            <h3>{formatDashboardNumber(countStatus('under_review'), language)}</h3>
          </article>

          <article className="stat-card">
            <p>{getTranslation(language, 'inProgress')}</p>
            <h3>{formatDashboardNumber(countStatus('in_progress'), language)}</h3>
          </article>

          <article className="stat-card">
            <p>{getTranslation(language, 'resolved')}</p>
            <h3>{formatDashboardNumber(countStatus('resolved'), language)}</h3>
          </article>

          <article className="stat-card resolution-rate-card">
            <p>{getTranslation(language, 'resolutionRate')}</p>
            <h3>{formatDashboardNumber(resolvedRate, language)}<span className="resolution-rate-percent">%</span></h3>
            <div className="resolution-rate-track">
              <div
                className="resolution-rate-fill"
                style={{ width: `${resolvedRate}%` }}
              />
            </div>
            <span>
              {formatDashboardNumber(resolvedCount, language)} / {formatDashboardNumber(reports.length, language)}
            </span>
          </article>
        </section>
      </>
)}
        {activePage === 'reports' && (
  <section className="reports-section" id="reports">
          <div className="section-heading">
            <div className="reports-heading-copy">
  <h2>{language === 'ar' ? '\u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A' : 'Reports'}</h2>
  <p className="page-description">{getTranslation(language, 'reportsDescription')}</p>
</div>

            <div className="reports-toolbar">
  <div className="reports-actions">
<button
              type="button"
              onClick={exportReportsCsv}
              disabled={filteredReports.length === 0}
              className="export-button"
            >
              {language === 'ar' ? '\u062A\u0635\u062F\u064A\u0631 CSV' : 'Export CSV'}
            </button>
            <button
              type="button"
              onClick={printReports}
              disabled={filteredReports.length === 0}
              className="export-button"
            >
              {language === 'ar' ? '\u0637\u0628\u0627\u0639\u0629' : 'Print'}
            </button>
  </div>
  <div className="reports-filter">
<select
              aria-label={getTranslation(language, 'filterByStatus')}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">{getTranslation(language, 'allStatuses')}</option>
              <option value="submitted">{translateStatus('submitted', language)}</option>
              <option value="ai_analyzed">{translateStatus('ai_analyzed', language)}</option>
              <option value="assigned">{translateStatus('assigned', language)}</option>
              <option value="under_review">{translateStatus('under_review', language)}</option>
              <option value="in_progress">{translateStatus('in_progress', language)}</option>
              <option value="resolved">{translateStatus('resolved', language)}</option>
              <option value="rejected">{translateStatus('rejected', language)}</option>
              <option value="manual_review_required">
                {translateStatus('manual_review_required', language)}
              </option>
            </select>
  </div>
</div>
          </div>

          {reportsLoading && (
            <p className="empty-state">{getTranslation(language, 'loading')}</p>
          )}

          {reportsError && (
            <p className="auth-error" role="alert">
              {reportsError}
            </p>
          )}

          {!reportsLoading && !reportsError && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th><div className="report-heading-center">{getTranslation(language, 'report')}</div></th>
                    <th><div className="report-heading-center">{getTranslation(language, 'category')}</div></th>
                    <th><div className="report-heading-center">{getTranslation(language, 'aiImageDescription')}</div></th>
                    <th><div className="report-heading-center">{getTranslation(language, 'status')}</div></th>
                    <th><div className="report-heading-center">{getTranslation(language, 'date')}</div></th>
                    <th><div className="report-heading-center">{language === 'ar' ? '\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a' : 'ACTIONS'}</div></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        <div className="empty-icon">
                          <FileText size={28} strokeWidth={1.8} aria-hidden="true" />
                        </div>
                        <h3>{getTranslation(language, 'noReports')}</h3>
                        <p>
                          {getTranslation(language, 'reportsEmptyDescription')}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((report) => (
                      <tr key={report.id}>
                        <td>
                          <strong>{report.report_code}</strong>
                        </td>
                        <td>{report.category ? translateCategory(report.category, language) : getTranslation(language, 'uncategorized')}</td>
                        <td><div className="ai-image-description-cell">{report.image_description?.trim() || getTranslation(language, 'noAiImageDescription')}</div></td>
                        <td>
                          <span className="status-badge">
                            {translateStatus(report.status, language)}
                          </span>
                        </td>
                        <td>
                          {new Date(report.created_at).toLocaleDateString(
                            language === 'ar' ? 'ar-EG' : 'en-US'
                          )}
                        </td>
                        <td>
                          <select
                            aria-label="Change report status"
                            value={report.status}
                            disabled={updatingId === report.id}
                            onChange={(e) =>
                              void handleUpdateStatus(report.id, e.target.value)
                            }
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              border: '1px solid #dce3ed',
                              background: '#fff',
                            }}
                          >
                            <option value="submitted">{translateStatus('submitted', language)}</option>
                            <option value="ai_analyzed">{translateStatus('ai_analyzed', language)}</option>
                            <option value="assigned">{translateStatus('assigned', language)}</option>
                            <option value="under_review">{translateStatus('under_review', language)}</option>
                            <option value="in_progress">{translateStatus('in_progress', language)}</option>
                            <option value="resolved">{translateStatus('resolved', language)}</option>
                            <option value="rejected">{translateStatus('rejected', language)}</option>
                            <option value="manual_review_required">
                              {translateStatus('manual_review_required', language)}
                            </option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
)}
{activePage === 'gis' && <GISMap language={language} />}

{activePage === 'notifications' && (
  <section className="notifications-page">
    <div className="notifications-page-heading">
      <div>
        <h2>{getTranslation(language, 'notificationCenter')}</h2>
        <p>{getTranslation(language, 'notificationsDescription')}</p>
      </div>

      <button
        type="button"
        className="notifications-mark-all"
        onClick={() => void markAllNotificationsRead()}
        disabled={notificationsLoading || !notifications.some((item) => !item.read)}
      >
        {getTranslation(language, 'markAllAsRead')}
      </button>
    </div>

    {notificationsError && (
      <div className="notification-error" role="alert">
        {getTranslation(language, 'notificationLoadError')}
      </div>
    )}

    {notificationsLoading ? (
      <div className="notification-empty">
        {getTranslation(language, 'loading')}
      </div>
    ) : notifications.length === 0 ? (
      <div className="notification-empty">
        {getTranslation(language, 'noNotifications')}
      </div>
    ) : (
      <div className="notification-page-list">
        {notifications.map((item) => (
          <article
            key={item.id}
            className={`notification-card ${item.read ? 'is-read' : 'is-unread'}`}
          >
            <div className="notification-item">
              <div className="notification-content">
                <h3>{item.title}</h3>
                {item.body && <p>{item.body}</p>}
                <small>
                  {new Date(item.created_at).toLocaleString(
                    language === 'ar' ? 'ar-EG' : 'en-GB'
                  )}
                </small>
              </div>

              {!item.read && (
                <button
                  type="button"
                  className="notification-mark-read"
                  aria-label={getTranslation(language, 'markAsRead')}
                  onClick={() => void markNotificationRead(item.id)}
                >
                  <Check size={16} aria-hidden="true" />
                  {getTranslation(language, 'markAsRead')}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    )}
  </section>
)}
        <footer>{language === 'ar' ? 'CivicGuard \u00B7 \u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0625\u062f\u0627\u0631\u0629' : 'CivicGuard \u00B7 Admin Portal'}</footer>
      </main>
    </div>
  )
}

export default App

















