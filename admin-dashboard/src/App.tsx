
import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { adminApiClient } from './lib/api'
import './App.css'
import { FileText, MapPinned, Bell, Check, BarChart3, UsersRound } from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts'
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

  type TrendPeriod = '7d' | '30d' | '3m' | '6m' | '12m'
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('6m')

  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(() => new Set())
  const [activePage, setActivePage] = useState<'overview' | 'reports' | 'gis' | 'notifications' | 'users'>('gis')
  const [managedUsers, setManagedUsers] = useState<Array<{
    id: string
    role: string
    full_name?: string | null
    display_name?: string | null
  }>>([])
  const [managedUsersLoading, setManagedUsersLoading] = useState(false)
  const [managedUsersError, setManagedUsersError] = useState('')
  const [usersSearch, setUsersSearch] = useState('')
  const [usersRoleFilter, setUsersRoleFilter] = useState('staff')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [newUserFullName, setNewUserFullName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<'' | 'admin' | 'authority'>('')
  const [newUserNationalId, setNewUserNationalId] = useState('')
  const [creatingUser, setCreatingUser] = useState(false)
  const [createUserError, setCreateUserError] = useState('')
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

  // Load real profile records for the Users & Permissions page.
  useEffect(() => {
    if (activePage !== 'users' || !user) return

    let mounted = true

    async function loadManagedUsers() {
      setManagedUsersLoading(true)
      setManagedUsersError('')

      const { data, error: loadError } = await supabase
        .from('profiles')
        .select('id, role, full_name, display_name')
        .order('role', { ascending: true })

      if (!mounted) return

      if (loadError) {
        setManagedUsersError(
          language === 'ar'
            ? 'تعذر تحميل المستخدمين. تحقق من سياسات الوصول إلى جدول profiles.'
            : 'Unable to load users. Check the access policies for the profiles table.'
        )
        setManagedUsers([])
      } else {
        setManagedUsers(data ?? [])
      }

      setManagedUsersLoading(false)
    }

    void loadManagedUsers()

    return () => {
      mounted = false
    }
  }, [activePage, user, language])
  
  async function editManagedUser(managedUser: {
    id: string
    role: string
    full_name?: string | null
    display_name?: string | null
  }) {
    const isArabic = language === 'ar'
    const currentName = managedUser.display_name || managedUser.full_name || ''
    const newName = window.prompt(
      isArabic ? 'أدخل الاسم الجديد للمستخدم:' : 'Enter the new display name:',
      currentName
    )

    if (newName === null) return

    const trimmedName = newName.trim()
    if (!trimmedName) {
      window.alert(isArabic ? 'الاسم لا يمكن أن يكون فارغًا.' : 'Name cannot be empty.')
      return
    }
    if (trimmedName === currentName) return

    setUpdatingId(managedUser.id)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: trimmedName })
        .eq('id', managedUser.id)
        .select('id, role, full_name, display_name')

      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('No profile was updated. Check database permissions.')
      }

      setManagedUsers((previous) =>
        previous.map((item) =>
          item.id === managedUser.id ? { ...item, ...data[0] } : item
        )
      )

      window.alert(isArabic ? 'تم تحديث الاسم بنجاح.' : 'Name updated successfully.')
    } catch (error) {
      console.error('Unable to update managed user:', error)
      window.alert(
        isArabic
          ? 'تعذر تحديث الاسم. تحقق من صلاحيات Supabase.'
          : 'Unable to update the name. Check Supabase permissions.'
      )
    } finally {
      setUpdatingId(null)
    }
  }

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
    }, 60000)

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

          <p className="auth-footer">{language === 'ar' ? '\u062f\u062e\u0648\u0644 \u0645\u0642\u064a\u062f \u0644\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0646 \u0627\u0644\u0645\u0635\u0631\u062d \u0644\u0647\u0645 \u0641\u0642\u0637' : 'Restricted access ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Authorized administrators only'}</p>
        </section>
      </main>
    )
  }

  const escapeCsv = (value: string) =>
    `"${value.replace(/"/g, '""')}"`

  function exportReportsCsv() {
    const headers = language === 'ar'
      ? ['\u0631\u0642\u0645 \u0627\u0644\u0628\u0644\u0627\u063A', '\u0627\u0644\u0641\u0626\u0629', '\u0648\u0635\u0641 \u0627\u0644\u0635\u0648\u0631\u0629 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A', '\u0627\u0644\u062D\u0627\u0644\u0629', '\u0627\u0644\u062A\u0627\u0631\u064A\u062E']
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
    const reportsToPrint = selectedReportIds.size > 0
      ? filteredReports.filter((report) => selectedReportIds.has(report.id))
      : filteredReports
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert(language === 'ar'
        ? '\u064A\u0631\u062C\u0649 \u0627\u0644\u0633\u0645\u0627\u062D \u0628\u0627\u0644\u0646\u0648\u0627\u0641\u0630 \u0627\u0644\u0645\u0646\u0628\u062B\u0642\u0629 \u0644\u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A.'
        : 'Please allow pop-ups to print reports.')
      return
    }

    const headers = language === 'ar'
      ? ['\u0631\u0642\u0645 \u0627\u0644\u0628\u0644\u0627\u063A', '\u0627\u0644\u0641\u0626\u0629', '\u0648\u0635\u0641 \u0627\u0644\u0635\u0648\u0631\u0629', '\u0627\u0644\u062D\u0627\u0644\u0629', '\u0627\u0644\u062A\u0627\u0631\u064A\u062E']
      : ['Report ID', 'Category', 'Image Description', 'Status', 'Date']

    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      })[char]!)

    const rows = reportsToPrint.map((report) => [
      report.report_code,
      report.category
        ? translateCategory(report.category, language)
        : getTranslation(language, 'uncategorized'),
      report.image_description?.trim() || '',
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
        <title>${language === 'ar' ? '\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A' : 'CivicGuard Reports'}</title>
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
        <h2>${language === 'ar' ? '\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A' : 'CivicGuard Reports'}</h2>
        <p>${language === 'ar' ? '\u0639\u062F\u062F \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A:' : 'Total reports:'} ${reportsToPrint.length}</p>
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
  const statusChartData = Object.entries(
    reports.reduce<Record<string, number>>((counts, report) => {
      const status = report.status || 'unknown'
      counts[status] = (counts[status] || 0) + 1
      return counts
    }, {})
  ).map(([status, count]) => ({
    name: translateStatus(status, language),
    value: count,
    status,
  }))

  const categoryChartData = Object.entries(
    reports.reduce<Record<string, number>>((counts, report) => {
      const category = report.category?.trim() || 'uncategorized'
      counts[category] = (counts[category] || 0) + 1
      return counts
    }, {})
  )
    .map(([category, count]) => ({
      name: translateCategory(category, language),
      value: count,
      category,
    }))
    .sort((a, b) => b.value - a.value)

  const monthlyChartData = (() => {
    const now = new Date()
    const daily = trendPeriod === '7d' || trendPeriod === '30d'
    const amount = trendPeriod === '7d' ? 7
      : trendPeriod === '30d' ? 30
      : trendPeriod === '3m' ? 3
      : trendPeriod === '12m' ? 12
      : 6

    return Array.from({ length: amount }, (_, index) => {
      if (daily) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        date.setDate(date.getDate() - (amount - 1 - index))

        const count = reports.filter((report) => {
          const created = new Date(report.created_at)
          return !Number.isNaN(created.getTime()) &&
            created.getFullYear() === date.getFullYear() &&
            created.getMonth() === date.getMonth() &&
            created.getDate() === date.getDate()
        }).length

        return {
          key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          month: date.toLocaleDateString(
            language === 'ar' ? 'ar-EG' : 'en-GB',
            trendPeriod === '7d'
              ? { weekday: 'short', day: 'numeric' }
              : { day: 'numeric', month: 'short' }
          ),
          count,
        }
      }

      const date = new Date(now.getFullYear(), now.getMonth() - (amount - 1 - index), 1)
      const year = date.getFullYear()
      const month = date.getMonth()

      const count = reports.filter((report) => {
        const created = new Date(report.created_at)
        return !Number.isNaN(created.getTime()) &&
          created.getFullYear() === year &&
          created.getMonth() === month
      }).length

      return {
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
        month: date.toLocaleDateString(
          language === 'ar' ? 'ar-EG' : 'en-GB',
          { month: 'short', year: '2-digit' }
        ),
        count,
      }
    })
  })()

  const chartColors = [
    '#3977e8',
    '#18a58b',
    '#e6a23c',
    '#e05b67',
    '#8b6bd6',
    '#64748b',
    '#16a6c4',
    '#a3a3a3',
  ]

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
    href="#gis"
    className={`nav-link ${activePage === 'gis' ? 'active' : ''}`}
    onClick={(event) => {
      event.preventDefault()
      setActivePage('gis')
    }}
  >
    <MapPinned size={18} strokeWidth={1.8} aria-hidden="true" /> {getTranslation(language, 'gisMap')}
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
    href="#overview"
    className={`nav-link ${activePage === 'overview' ? 'active' : ''}`}
    onClick={(event) => {
      event.preventDefault()
      setActivePage('overview')
    }}
  >
    <BarChart3 size={18} strokeWidth={1.8} aria-hidden="true" /> {language === 'ar' ? 'مؤشرات أداء البلاغات' : 'Report Performance'}
  </a>
  <a
    href="#users"
    className={`nav-link ${activePage === 'users' ? 'active' : ''}`}
    onClick={(event) => {
      event.preventDefault()
      setActivePage('users')
    }}
  >
    <UsersRound size={18} strokeWidth={1.8} aria-hidden="true" /> {language === 'ar' ? 'المستخدمون والصلاحيات' : 'Users & Permissions'}
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
  <section className="analytics-page" id="overview">
    <section className="analytics-heading">
      <div>
        <h2>{language === 'ar' ? '\u0645\u0624\u0634\u0631\u0627\u062a \u0623\u062f\u0627\u0621 \u0627\u0644\u0628\u0644\u0627\u063a\u0627\u062a' : 'Report Performance'}</h2>
        <p>
          {language === 'ar'
            ? '\u0646\u0638\u0631\u0629 \u062a\u062d\u0644\u064a\u0644\u064a\u0629 \u0639\u0644\u0649 \u0627\u0644\u0628\u0644\u0627\u063a\u0627\u062a \u0648\u062d\u0627\u0644\u0627\u062a\u0647\u0627 \u0648\u0627\u062a\u062c\u0627\u0647\u0627\u062a\u0647\u0627.'
            : 'An analytical view of report volume, status distribution, and trends.'}
        </p>
      </div>
      <div className="analytics-heading-icon">
        <BarChart3 size={28} aria-hidden="true" />
      </div>
    </section>

    <section className="stats-grid analytics-stats-grid">
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
        <h3>{formatDashboardNumber(resolvedCount, language)}</h3>
      </article>
      <article className="stat-card resolution-rate-card">
        <p>{getTranslation(language, 'resolutionRate')}</p>
        <h3>
          {formatDashboardNumber(resolvedRate, language)}
          <span className="resolution-rate-percent">%</span>
        </h3>
        <div className="resolution-rate-track">
          <div className="resolution-rate-fill" style={{ width: `${resolvedRate}%` }} />
        </div>
        <span>
          {formatDashboardNumber(resolvedCount, language)} / {formatDashboardNumber(reports.length, language)}
        </span>
      </article>
    </section>

    {reportsLoading && (
      <p className="analytics-empty">{getTranslation(language, 'loading')}</p>
    )}

    {reportsError && (
      <p className="analytics-empty analytics-error">{getTranslation(language, 'reportsError')}</p>
    )}

    {!reportsLoading && !reportsError && (
      <>
        <section className="analytics-chart-grid">
          <article className="analytics-chart-card">
            <div className="analytics-chart-heading">
              <h3>{language === 'ar' ? '\u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u0628\u0644\u0627\u063a\u0627\u062a \u062d\u0633\u0628 \u0627\u0644\u062d\u0627\u0644\u0629' : 'Reports by status'}</h3>
              <p>{language === 'ar' ? '\u0639\u062f\u062f \u0627\u0644\u0628\u0644\u0627\u063a\u0627\u062a \u0641\u064a \u0643\u0644 \u062d\u0627\u0644\u0629' : 'Report count for each status'}</p>
            </div>
            {statusChartData.length > 0 ? (
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="46%"
                      outerRadius={94}
                      innerRadius={52}
                      paddingAngle={3}
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={entry.status} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatDashboardNumber(Number(value), language)} />
                    <Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="analytics-empty">{getTranslation(language, 'noReports')}</p>
            )}
          </article>

          <article className="analytics-chart-card">
            <div className="analytics-chart-heading">
              <h3>{language === 'ar' ? '\u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u0628\u0644\u0627\u063a\u0627\u062a \u062d\u0633\u0628 \u0627\u0644\u062a\u0635\u0646\u064a\u0641' : 'Reports by category'}</h3>
              <p>{language === 'ar' ? '\u0639\u062f\u062f \u0627\u0644\u0628\u0644\u0627\u063a\u0627\u062a \u062d\u0633\u0628 \u0643\u0644 \u062a\u0635\u0646\u064a\u0641' : 'Report count by category'}</p>
            </div>
            {categoryChartData.length > 0 ? (
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...categoryChartData].sort((a, b) => b.value - a.value).slice(0, 8)}
                    margin={{ top: 8, right: 8, left: 0, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={0} textAnchor="middle" interval={0} height={58} tickMargin={8} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                    <Tooltip formatter={(value) => formatDashboardNumber(Number(value), language)} />
                    <Bar
                      dataKey="value"
                      name={language === 'ar' ? '\u0639\u062f\u062f \u0627\u0644\u0628\u0644\u0627\u063a\u0627\u062a' : 'Reports'}
                      fill="#3977e8"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="analytics-empty">{getTranslation(language, 'noReports')}</p>
            )}
          </article>
        </section>

        <section className="analytics-chart-card analytics-trend-card">
          <div className="analytics-chart-heading analytics-trend-heading">
            <div>
              <h3>
                {language === 'ar'
                  ? `\u0627\u062a\u062c\u0627\u0647 \u0627\u0644\u0628\u0644\u0627\u063a\u0627\u062a \u062e\u0644\u0627\u0644 ${trendPeriod === '7d' ? '\u0622\u062e\u0631 7 \u0623\u064a\u0627\u0645' : trendPeriod === '30d' ? '\u0622\u062e\u0631 30 \u064a\u0648\u0645\u064b\u0627' : trendPeriod === '3m' ? '\u0622\u062e\u0631 3 \u0623\u0634\u0647\u0631' : trendPeriod === '12m' ? '\u0622\u062e\u0631 12 \u0634\u0647\u0631\u064b\u0627' : '\u0622\u062e\u0631 6 \u0623\u0634\u0647\u0631'}`
                  : `Report trend over the last ${trendPeriod === '7d' ? '7 days' : trendPeriod === '30d' ? '30 days' : trendPeriod === '3m' ? '3 months' : trendPeriod === '12m' ? '12 months' : '6 months'}`}
              </h3>
              <p>{language === 'ar' ? '\u0639\u062f\u062f \u0627\u0644\u0628\u0644\u0627\u063a\u0627\u062a \u062d\u0633\u0628 \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0625\u0646\u0634\u0627\u0621' : 'Reports grouped by creation date'}</p>
            </div>
            <select
              className="analytics-trend-period"
              aria-label={language === 'ar' ? '\u0627\u062e\u062a\u0631 \u0627\u0644\u0641\u062a\u0631\u0629 \u0627\u0644\u0632\u0645\u0646\u064a\u0629' : 'Select trend period'}
              value={trendPeriod}
              onChange={(event) => setTrendPeriod(event.target.value as TrendPeriod)}
            >
              <option value="7d">{language === 'ar' ? '\u0622\u062e\u0631 7 \u0623\u064a\u0627\u0645' : 'Last 7 days'}</option>
              <option value="30d">{language === 'ar' ? '\u0622\u062e\u0631 30 \u064a\u0648\u0645\u064b\u0627' : 'Last 30 days'}</option>
              <option value="3m">{language === 'ar' ? '\u0622\u062e\u0631 3 \u0623\u0634\u0647\u0631' : 'Last 3 months'}</option>
              <option value="6m">{language === 'ar' ? '\u0622\u062e\u0631 6 \u0623\u0634\u0647\u0631' : 'Last 6 months'}</option>
              <option value="12m">{language === 'ar' ? '\u0622\u062e\u0631 12 \u0634\u0647\u0631\u064b\u0627' : 'Last 12 months'}</option>
            </select>
          </div>
          <div className="analytics-trend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyChartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3977e8" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#3977e8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
                <Tooltip formatter={(value) => formatDashboardNumber(Number(value), language)} />
                <Area
                  type="monotone"
                  dataKey="count"
                  name={language === 'ar' ? '\u0639\u062f\u062f \u0627\u0644\u0628\u0644\u0627\u063a\u0627\u062a' : 'Reports'}
                  stroke="#3977e8"
                  strokeWidth={3}
                  fill="url(#analyticsTrendFill)"
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </>
    )}
  </section>
)}{activePage === 'reports' && (
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
              {language === 'ar'
                ? `\u0637\u0628\u0627\u0639\u0629${selectedReportIds.size > 0 ? ` (${formatDashboardNumber(selectedReportIds.size, language)})` : ''}`
                : `Print${selectedReportIds.size > 0 ? ` (${selectedReportIds.size} selected)` : ''}`}
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
                    <th className="report-select-cell">
                      <input
                        type="checkbox"
                        aria-label={language === 'ar' ? '\u062A\u062D\u062F\u064A\u062F \u0643\u0644 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A \u0627\u0644\u0638\u0627\u0647\u0631\u0629' : 'Select all visible reports'}
                        checked={filteredReports.length > 0 && filteredReports.every((report) => selectedReportIds.has(report.id))}
                        onChange={(event) => {
                          setSelectedReportIds((current) => {
                            const next = new Set(current)
                            filteredReports.forEach((report) => {
                              if (event.target.checked) next.add(report.id)
                              else next.delete(report.id)
                            })
                            return next
                          })
                        }}
                      />
                    </th>
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
                      <td colSpan={7} className="empty-state">
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
                        <td className="report-select-cell">
                          <input
                            type="checkbox"
                            aria-label={`${language === 'ar' ? '\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0628\u0644\u0627\u063A' : 'Select report'} ${report.report_code}`}
                            checked={selectedReportIds.has(report.id)}
                            onChange={(event) => {
                              setSelectedReportIds((current) => {
                                const next = new Set(current)
                                if (event.target.checked) next.add(report.id)
                                else next.delete(report.id)
                                return next
                              })
                            }}
                          />
                        </td>
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

{activePage === 'users' && (
  <section className="users-permissions-page" id="users">
    <div className="users-permissions-heading">
      <div>
        <p className="users-eyebrow">
          {language === 'ar' ? 'إدارة الوصول' : 'ACCESS MANAGEMENT'}
        </p>
        <h2>
          {language === 'ar' ? 'المستخدمون والصلاحيات' : 'Users & Permissions'}
        </h2>
        <p>
          {language === 'ar'
            ? 'عرض حسابات المستخدمين والأدوار المسجلة حاليًا في النظام.'
            : 'View user accounts and the roles currently recorded in the system.'}
        </p>
      </div>
      <button
        type="button"
        className="users-add-button"
        onClick={() => {
          setCreateUserError('')
          setIsAddUserOpen(true)
        }}
      >
        <span aria-hidden="true">+</span>
        {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
      </button>
    </div>

    <div className="users-summary-grid">
      <article className="users-summary-card">
        <span>{language === 'ar' ? '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646' : 'Total users'}</span>
        <strong>{managedUsers.length.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</strong>
      </article>
      <article className="users-summary-card">
        <span>{language === 'ar' ? '\u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u0625\u062f\u0627\u0631\u0629' : 'Admin accounts'}</span>
        <strong>
          {managedUsers.filter((managedUser) => managedUser.role.toLowerCase().includes('admin')).length.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
        </strong>
      </article>
      <article className="users-summary-card">
        <span>{language === 'ar' ? '\u0623\u062f\u0648\u0627\u0631 \u0623\u062e\u0631\u0649' : 'Other roles'}</span>
        <strong>
          {managedUsers.filter((managedUser) => !managedUser.role.toLowerCase().includes('admin')).length.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
        </strong>
      </article>
    </div>

    <div className="users-directory-card">
      <div className="users-directory-heading">
        <div>
          <h3>{language === 'ar' ? 'دليل المستخدمين' : 'User directory'}</h3>
          <p>
            {language === 'ar'
              ? 'ابحث بالاسم أو معرّف الحساب، أو صفِّ النتائج حسب الدور.'
              : 'Search by name or account ID, or filter the results by role.'}
          </p>
        </div>
      </div>

      <div className="users-controls">
        <input
          type="search"
          value={usersSearch}
          onChange={(event) => setUsersSearch(event.target.value)}
          placeholder={language === 'ar' ? 'ابحث عن مستخدم...' : 'Search users...'}
          aria-label={language === 'ar' ? 'البحث عن المستخدمين' : 'Search users'}
        />
        <select
          value={usersRoleFilter}
          onChange={(event) => setUsersRoleFilter(event.target.value)}
          aria-label={language === 'ar' ? 'تصفية حسب الدور' : 'Filter by role'}
        >
          <option value="staff">{language === 'ar' ? '\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0648\u0627\u0644\u062C\u0647\u0627\u062A' : 'Admins & Authorities'}</option>
          <option value="all">{language === 'ar' ? '\u0643\u0644 \u0627\u0644\u0623\u062F\u0648\u0627\u0631' : 'All roles'}</option>
          {[...new Set(managedUsers.map((managedUser) => managedUser.role))].sort().map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        <button
          type="button"
          className="users-refresh-button"
          onClick={() => {
            setUsersSearch('')
            setUsersRoleFilter('staff')
            setActivePage('gis')
            window.setTimeout(() => setActivePage('users'), 0)
          }}
        >
          {language === 'ar' ? 'تحديث القائمة' : 'Refresh list'}
        </button>
      </div>

      {isAddUserOpen && (
        <div
          className="add-user-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingUser) {
              setIsAddUserOpen(false)
            }
          }}
        >
          <section
            className="add-user-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-user-modal-title"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          >
            <div className="add-user-modal-heading">
              <div>
                <p>{language === 'ar' ? 'إدارة الوصول' : 'ACCESS MANAGEMENT'}</p>
                <h3 id="add-user-modal-title">
                  {language === 'ar' ? 'إضافة مستخدم جديد' : 'Add a new user'}
                </h3>
              </div>
              <button
                type="button"
                className="add-user-close"
                aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
                disabled={creatingUser}
                onClick={() => setIsAddUserOpen(false)}
              >
                ×
              </button>
            </div>

            <form
              className="add-user-form"
              onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                event.preventDefault()
                setCreateUserError('')
                setCreatingUser(true)

                try {
                  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
                  const token = sessionData.session?.access_token
                  if (sessionError || !token) {
                    throw new Error(
                      language === 'ar'
                        ? 'انتهت جلسة الدخول. سجّل الدخول مرة أخرى.'
                        : 'Your session has expired. Please sign in again.'
                    )
                  }

                  const result = await adminApiClient<{
                    user: {
                      id: string
                      email: string
                      full_name: string
                      role: string
                    }
                  }>('/v1/auth/users', {
                    token,
                    method: 'POST',
                    body: JSON.stringify({
                      full_name: newUserFullName.trim(),
                      email: newUserEmail.trim(),
                      password: newUserPassword,
                      role: newUserRole,
                      national_id: newUserNationalId.trim(),
                    }),
                  })

                  setManagedUsers((current) => [
                    {
                      id: result.user.id,
                      role: result.user.role,
                      full_name: result.user.full_name,
                      display_name: result.user.full_name,
                    },
                    ...current.filter((item) => item.id !== result.user.id),
                  ])

                  setIsAddUserOpen(false)
                  setNewUserFullName('')
                  setNewUserEmail('')
                  setNewUserPassword('')
                  setNewUserRole('')
                  setNewUserNationalId('')
                } catch (error) {
                  setCreateUserError(
                    error instanceof Error
                      ? error.message
                      : language === 'ar'
                        ? 'تعذّر إنشاء المستخدم.'
                        : 'Unable to create the user.'
                  )
                } finally {
                  setCreatingUser(false)
                }
              }}
            >
              <label htmlFor="add-user-full-name">
                {language === 'ar' ? 'الاسم الكامل' : 'Full name'}
              </label>
              <input
                id="add-user-full-name"
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={120}
                required
                value={newUserFullName}
                onChange={(event) => setNewUserFullName(event.target.value)}
                placeholder={language === 'ar' ? 'اكتب الاسم الكامل' : 'Enter full name'}
              />

              <label htmlFor="add-user-email">
                {language === 'ar' ? 'البريد الإلكتروني' : 'Email address'}
              </label>
              <input
                id="add-user-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                value={newUserEmail}
                onChange={(event) => setNewUserEmail(event.target.value)}
                placeholder="name@example.com"
                dir="ltr"
              />

              <label htmlFor="add-user-password">
                {language === 'ar' ? 'كلمة المرور المؤقتة' : 'Temporary password'}
              </label>
              <input
                id="add-user-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
                value={newUserPassword}
                onChange={(event) => setNewUserPassword(event.target.value)}
                placeholder={language === 'ar' ? '10 أحرف على الأقل' : 'At least 10 characters'}
                dir="ltr"
              />

              <label htmlFor="add-user-national-id">
                {language === 'ar' ? 'الرقم القومي' : 'Egyptian national ID'}
              </label>
              <input
                id="add-user-national-id"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                minLength={14}
                maxLength={14}
                pattern="[0-9٠-٩۰-۹]{14}"
                required
                value={newUserNationalId}
                onChange={(event) => setNewUserNationalId(event.target.value)}
                placeholder={language === 'ar' ? 'أدخل 14 رقمًا' : 'Enter 14 digits'}
                dir="ltr"
              />

              <label htmlFor="add-user-role">
                {language === 'ar' ? 'نوع الحساب' : 'Account type'}
              </label>
              <select
                id="add-user-role"
                value={newUserRole}
                onChange={(event) => setNewUserRole(event.target.value as '' | 'admin' | 'authority')}
                required
              >
                <option value="" disabled>
                  {language === 'ar' ? 'اختر نوع الحساب' : 'Select account type'}
                </option>
                <option value="admin">{language === 'ar' ? 'أدمن' : 'Admin'}</option>
                <option value="authority">{language === 'ar' ? 'مسؤول جهة حكومية' : 'Government Authority Officer'}</option>
              </select>

              {createUserError && (
                <div className="add-user-error" role="alert">{createUserError}</div>
              )}

              <div className="add-user-form-actions">
                <button
                  type="button"
                  className="add-user-cancel"
                  disabled={creatingUser}
                  onClick={() => setIsAddUserOpen(false)}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="add-user-submit" disabled={creatingUser}>
                  {creatingUser
                    ? (language === 'ar' ? 'جارٍ الإنشاء...' : 'Creating...')
                    : (language === 'ar' ? 'إنشاء مستخدم' : 'Create user')}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {managedUsersLoading && (
        <p className="users-feedback">
          {language === 'ar' ? 'جارٍ تحميل المستخدمين...' : 'Loading users...'}
        </p>
      )}

      {!managedUsersLoading && managedUsersError && (
        <div className="users-error" role="alert">{managedUsersError}</div>
      )}

      {!managedUsersLoading && !managedUsersError && (
        <div className="users-table-wrap">
          <table className="users-table" dir={language === 'ar' ? 'rtl' : 'ltr'}>
  <thead>
    <tr>
      <th>{language === 'ar' ? 'المستخدم' : 'User'}</th>
      <th>{language === 'ar' ? 'معرّف الحساب' : 'Account ID'}</th>
      <th>{language === 'ar' ? 'الدور' : 'Role'}</th>
      <th>{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
    </tr>
  </thead>
  <tbody>
    {managedUsers
      .filter((managedUser) => {
        const query = usersSearch.trim().toLowerCase()
        const name = (managedUser.display_name || managedUser.full_name || '').toLowerCase()
        const matchesSearch =
          !query || name.includes(query) || managedUser.id.toLowerCase().includes(query)
        const role = managedUser.role.toLowerCase()
        const matchesRole =
          usersRoleFilter === 'all' ||
          (usersRoleFilter === 'staff'
            ? ['admin', 'authority'].includes(role)
            : managedUser.role === usersRoleFilter)
        return matchesSearch && matchesRole
      })
      .map((managedUser) => (
        <tr key={managedUser.id}>
          <td>
            <div className="users-name-cell">
              <span className="users-avatar" aria-hidden="true">
                {(managedUser.display_name || managedUser.full_name || managedUser.id)
                  .slice(0, 1).toUpperCase()}
              </span>
              <span className="users-display-name">
                {managedUser.display_name || managedUser.full_name ||
                  (language === 'ar' ? 'مستخدم بدون اسم' : 'Unnamed user')}
              </span>
            </div>
          </td>
          <td dir="ltr" className="users-account-id">
            <code>{managedUser.id}</code>
          </td>
          <td>
            <span className={`users-role-pill ${
              managedUser.role.toLowerCase() === 'admin' ? 'is-admin' : ''
            }`}>
              {managedUser.role.toLowerCase() === 'admin'
                ? (language === 'ar' ? 'مدير النظام' : 'Admin')
                : managedUser.role.toLowerCase() === 'authority'
                  ? (language === 'ar' ? 'مسؤول جهة حكومية' : 'Government Authority Officer')
                  : managedUser.role}
            </span>
          </td>
          <td>
            <button
              type="button"
              className="users-edit-button"
              disabled={updatingId === managedUser.id}
              onClick={() => void editManagedUser(managedUser)}
            >
              {updatingId === managedUser.id
                ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...')
                : (language === 'ar' ? 'تعديل' : 'Edit')}
            </button>
          </td>
        </tr>
      ))}
  </tbody>
</table>

          {managedUsers.filter((managedUser) => {
            const query = usersSearch.trim().toLowerCase()
            const name = (managedUser.display_name || managedUser.full_name || '').toLowerCase()
            return (!query || name.includes(query) || managedUser.id.toLowerCase().includes(query))
              && (usersRoleFilter === 'all' || (usersRoleFilter === 'staff' ? ['admin', 'authority'].includes(managedUser.role.toLowerCase()) : managedUser.role === usersRoleFilter))
          }).length === 0 && (
            <p className="users-feedback">
              {language === 'ar' ? 'لا توجد نتائج مطابقة.' : 'No matching users found.'}
            </p>
          )}
        </div>
      )}

      <p className="users-permissions-note">
        <strong>{language === 'ar' ? 'ملاحظة أمنية:' : 'Security note:'}</strong>{' '}
        {language === 'ar'
          ? 'هذه الصفحة مخصصة للعرض والبحث فقط. إنشاء الحسابات محمي بصلاحيات الخادم.'
          : 'You can create accounts using Add User. Account creation is protected by server-side authorization.'}
      </p>
    </div>
  </section>
)}
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


















