import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { adminApiClient } from './lib/api'
import {
  getTranslation,
  translateCategory,
  translateStatus,
  type Language,
} from './i18n'

// Shape returned by GET /v1/authority/reports/:id/duplicates
type DuplicateItem = {
  id: string
  relation: 'earlier_report' | 'later_report'
  distance_m: number
  detected_at: string
  ai: {
    checked: boolean
    same_issue: boolean | null
    confidence: number | null
    reason: string | null
  }
  report: {
    id: string
    report_code: string | null
    category: string | null
    status: string | null
    severity: string | null
    description: string | null
    created_at: string
    image_url: string | null
  }
}

type Props = {
  reportId: string
  reportStatus: string | null
  language: Language
  /** Opens another report's details. Returns false if it is not in the loaded list. */
  onOpenReport: (reportId: string) => boolean
  /** Called after this report was marked as duplicate through the API. */
  onMarkedDuplicate: (reportId: string, status: string) => void
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('No valid session token found')
  return token
}

/**
 * Staff-only list of possible duplicates for one report.
 * Render it with key={reportId} so state resets when another report is opened.
 * Citizens never receive this data (the backend only exposes it to authority/admin).
 */
export default function DuplicatesPanel({
  reportId,
  reportStatus,
  language,
  onOpenReport,
  onMarkedDuplicate,
}: Props) {
  const t = (key: Parameters<typeof getTranslation>[1]) =>
    getTranslation(language, key)

  const [items, setItems] = useState<DuplicateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionDone, setActionDone] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const token = await getToken()
        const res = await adminApiClient<{ duplicates: DuplicateItem[] }>(
          `/v1/authority/reports/${reportId}/duplicates`,
          { token },
        )
        if (!cancelled) setItems(res.duplicates ?? [])
      } catch (err) {
        // The panel is optional: on any failure it simply stays hidden.
        console.warn('[CivicGuard] Could not load possible duplicates:', err)
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [reportId])

  async function markAsDuplicate(item: DuplicateItem) {
    const code = item.report.report_code || item.report.id
    if (!window.confirm(t('confirmMarkDuplicate').replace('{code}', code))) {
      return
    }

    setMarkingId(item.id)
    setActionError('')
    setActionDone(false)

    try {
      const token = await getToken()
      await adminApiClient(`/v1/authority/reports/${reportId}/status`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          status: 'duplicate',
          duplicate_of: item.report.id,
          note: `Marked as duplicate of ${code}`,
        }),
      })
      setActionDone(true)
      onMarkedDuplicate(reportId, 'duplicate')
    } catch (err) {
      const code400 = (err as { code?: string }).code
      setActionError(
        code400 === 'INVALID_STATUS_TRANSITION'
          ? t('duplicateTransitionError')
          : `${t('duplicateActionFailed')} ${(err as Error).message}`,
      )
    } finally {
      setMarkingId(null)
    }
  }

  if (loading) {
    return <p className="gis-dup-muted">{t('checkingDuplicates')}</p>
  }
  if (items.length === 0) return null

  const formatDate = (value: string) =>
    new Date(value).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <section className="gis-dup" aria-label={t('possibleDuplicates')}>
      <div className="gis-dup-header">
        <h4>{t('possibleDuplicates')}</h4>
        <span className="gis-dup-count">
          {items.length.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB')}
        </span>
      </div>

      <ul className="gis-dup-list">
        {items.map((item) => {
          const code = item.report.report_code || item.report.id
          const distance = Math.round(item.distance_m).toLocaleString(
            language === 'ar' ? 'ar-EG' : 'en-GB',
          )
          const confidencePct =
            item.ai.confidence != null
              ? Math.round(item.ai.confidence * 100).toLocaleString(
                  language === 'ar' ? 'ar-EG' : 'en-GB',
                )
              : ''

          let aiClass = 'gis-dup-ai gis-dup-ai-unchecked'
          let aiText = t('aiNotCompared')
          if (item.ai.checked && item.ai.same_issue) {
            aiClass = 'gis-dup-ai gis-dup-ai-same'
            aiText = t('aiSameIssue').replace('{pct}', confidencePct)
          } else if (item.ai.checked) {
            aiClass = 'gis-dup-ai gis-dup-ai-different'
            aiText = t('aiLooksDifferent')
          }

          return (
            <li key={item.id} className="gis-dup-item">
              {item.report.image_url ? (
                <a
                  className="gis-dup-thumb"
                  href={item.report.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('viewDuplicatePhoto')}
                >
                  <img src={item.report.image_url} alt={code} loading="lazy" />
                </a>
              ) : (
                <div className="gis-dup-thumb gis-dup-thumb-empty">
                  {t('noPhoto')}
                </div>
              )}

              <div className="gis-dup-body">
                <div className="gis-dup-title">
                  <strong>{code}</strong>
                  <button
                    type="button"
                    className="gis-dup-link"
                    onClick={() => {
                      if (!onOpenReport(item.report.id)) {
                        setActionError(t('duplicateNotInList'))
                      }
                    }}
                  >
                    {t('openReport')}
                  </button>
                </div>

                <p className="gis-dup-meta">
                  {item.report.category
                    ? translateCategory(item.report.category, language)
                    : t('notSpecified')}
                  {' · '}
                  {item.report.status
                    ? translateStatus(item.report.status, language)
                    : t('unknown')}
                  {' · '}
                  {t('duplicateDistance').replace('{n}', distance)}
                  {' · '}
                  {formatDate(item.report.created_at)}
                </p>

                <p className="gis-dup-relation">
                  {item.relation === 'earlier_report'
                    ? t('duplicateEarlier')
                    : t('duplicateLater')}
                </p>

                <span className={aiClass}>{aiText}</span>
                {item.ai.checked && item.ai.reason && (
                  <p className="gis-dup-reason">{item.ai.reason}</p>
                )}

                {item.relation === 'earlier_report' &&
                  reportStatus !== 'duplicate' && (
                    <button
                      type="button"
                      className="gis-dup-mark"
                      disabled={markingId !== null}
                      onClick={() => void markAsDuplicate(item)}
                    >
                      {markingId === item.id
                        ? t('markingDuplicate')
                        : t('markAsDuplicate').replace('{code}', code)}
                    </button>
                  )}
              </div>
            </li>
          )
        })}
      </ul>

      {actionError && (
        <p className="gis-dup-error" role="alert">
          {actionError}
        </p>
      )}
      {actionDone && (
        <p className="gis-dup-success" role="status">
          {t('duplicateMarked')}
        </p>
      )}
    </section>
  )
}
