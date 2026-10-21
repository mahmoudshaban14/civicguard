
import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import './App.css'
import { LayoutDashboard, FileText, MapPinned, Sparkles } from 'lucide-react'
import GISMap from './GISMap'
import { getTranslation, translateStatus, translateCategory, type Language } from './i18n'

type Profile = {
  id: string
  role: string
}

type Report = {
  id: string
  report_code: string
  category: string | null
  status: string
  created_at: string
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
const [activePage, setActivePage] = useState<
  'overview' | 'reports' | 'gis'
>('overview')

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
        .select('id, role')
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

  // Load reports only after the admin role has been verified.
  useEffect(() => {
    let mounted = true

    async function loadReports() {
      if (!user || profile?.role !== 'admin') return

      setReportsLoading(true)
      setReportsError('')

      const { data, error: queryError } = await supabase
        .from('reports')
        .select('id, report_code, category, status, created_at')
        .order('created_at', { ascending: false })

      if (!mounted) return

      if (queryError) {
        setReports([])
        setReportsError(
          `Reports could not be loaded: ${queryError.message}`,
        )
      } else {
        setReports((data ?? []) as Report[])
      }

      setReportsLoading(false)
    }

    void loadReports()

    return () => {
      mounted = false
    }
  }, [user, profile])

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
          <p className="eyebrow">{getTranslation(language, 'management')}</p>
          <h1>{getTranslation(language, 'adminPortal')}</h1>
          <p className="auth-description">
            {getTranslation(language, 'loginDescription')}
          </p>

          <form onSubmit={handleSignIn}>
            <label htmlFor="email">{getTranslation(language, 'email')}</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="admin@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label htmlFor="password">{getTranslation(language, 'password')}</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder={getTranslation(language, 'password')}
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

          <p className="auth-footer">
            Restricted access · Authorized administrators only
          </p>
        </section>
      </main>
    )
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
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">C</div>
          <div>
            <h2>CivicGuard</h2>
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

        <div className="sidebar-bottom">
          <div className="connection-indicator" />
          <div>
            <strong>Supabase</strong>
            <p>{getTranslation(language, 'adminSession')}</p>
          </div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div>
            <p className="breadcrumb">
  {getTranslation(language, 'management')} /{' '}
  {activePage === 'overview'
    ? getTranslation(language, 'overview')
    : activePage === 'reports'
      ? getTranslation(language, 'reports')
      : getTranslation(language, 'gisMap')}
</p>

<h1>
  {activePage === 'overview'
    ? getTranslation(language, 'dashboard')
    : activePage === 'reports'
      ? getTranslation(language, 'reports')
      : getTranslation(language, 'gisMap')}
</h1>
          </div>

          <div className="admin-badge">
            <span className="avatar">A</span>
            <span>{getTranslation(language, 'administrator')}</span>
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
                    <button
            type="button"
            className="language-toggle"
            onClick={() =>
              setLanguage((current) => (current === 'ar' ? 'en' : 'ar'))
            }
          >
            {language === 'ar' ? 'English' : 'العربية'}
          </button>
        </header>

{activePage === 'overview' && (
  <>

        <section className="welcome">
          <div>
            <p className="eyebrow">{getTranslation(language, 'management')}</p>
            <h2>{getTranslation(language, 'overview')}</h2>
            <p>
              {getTranslation(language, 'loginDescription')}
            </p>
          </div>
          <div className="welcome-icon"><Sparkles size={28} strokeWidth={1.7} aria-hidden="true" /></div>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <p>{getTranslation(language, 'totalReports')}</p>
            <h3>{reports.length}</h3>
            <span>{getTranslation(language, 'totalReports')}</span>
          </article>

          <article className="stat-card">
            <p>{getTranslation(language, 'underReview')}</p>
            <h3>{countStatus('under_review')}</h3>
            <span>{getTranslation(language, 'underReview')}</span>
          </article>

          <article className="stat-card">
            <p>{getTranslation(language, 'inProgress')}</p>
            <h3>{countStatus('in_progress')}</h3>
            <span>{getTranslation(language, 'inProgress')}</span>
          </article>

          <article className="stat-card">
            <p>{getTranslation(language, 'resolved')}</p>
            <h3>{countStatus('resolved')}</h3>
            <span>{getTranslation(language, 'resolved')}</span>
          </article>

          <article className="stat-card resolution-rate-card">
            <p>{getTranslation(language, 'resolutionRate')}</p>
            <h3>{resolvedRate}%</h3>
            <div className="resolution-rate-track">
              <div
                className="resolution-rate-fill"
                style={{ width: `${resolvedRate}%` }}
              />
            </div>
            <span>
              {resolvedCount} / {reports.length}
            </span>
          </article>
        </section>
      </>
)}
        {activePage === 'reports' && (
  <section className="reports-section" id="reports">
          <div className="section-heading">
            <div>
              <h2>{getTranslation(language, 'allReports')}</h2>
              <p>{getTranslation(language, 'mapDescription')}</p>
            </div>

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
                    <th>{getTranslation(language, 'report')}</th>
                    <th>{getTranslation(language, 'category')}</th>
                    <th>{getTranslation(language, 'status')}</th>
                    <th>{getTranslation(language, 'date')}</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty-state">
                        <div className="empty-icon"><FileText size={28} strokeWidth={1.8} aria-hidden="true" /></div>
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
                        <td>
                          <span className="status-badge">
                            {translateStatus(report.status, language)}
                          </span>
                        </td>
                        <td>
                          {new Date(report.created_at).toLocaleDateString()}
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

        <footer>CivicGuard Admin Portal · Development environment</footer>
      </main>
    </div>
  )
}

export default App


