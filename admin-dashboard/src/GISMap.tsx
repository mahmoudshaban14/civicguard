
import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import {
  Marker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import { supabase } from './lib/supabase'
import 'leaflet/dist/leaflet.css'
import './GISMap.css'
import {
  getTranslation,
  translateCategory,
  translateSeverity,
  translateStatus,
  type Language,
  type TranslationKey,
} from './i18n'

type Report = {
  id: string
  report_code: string | null
  category: string | null
  status: string | null
  severity: string | null
  department: string | null
  created_at: string
  latitude: number | null
  longitude: number | null
  image_path: string | null
  description: string | null
}

type Position = [number, number]

type GovernorateFeature = {
  type: 'Feature'
  properties: {
    name: string
    country: string
  }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: Position[][] | Position[][][]
  }
}

type GovernoratesData = {
  type: 'FeatureCollection'
  features: GovernorateFeature[]
}

function translateGovernorate(name: string, language: Language): string {
  if (language !== 'ar') return name

  const translations: Record<string, string> = {
    'Cairo': '\u0627\u0644\u0642\u0627\u0647\u0631\u0629',
    'Giza': '\u0627\u0644\u062c\u064a\u0632\u0629',
    'Alexandria': '\u0627\u0644\u0625\u0633\u0643\u0646\u062f\u0631\u064a\u0629',
    'Qalyubia': '\u0627\u0644\u0642\u0644\u064a\u0648\u0628\u064a\u0629',
    'Qalubia': '\u0627\u0644\u0642\u0644\u064a\u0648\u0628\u064a\u0629',
    'Beheira': '\u0627\u0644\u0628\u062d\u064a\u0631\u0629',
    'Matrouh': '\u0645\u0637\u0631\u0648\u062d',
    'Damietta': '\u062f\u0645\u064a\u0627\u0637',
    'Dakahlia': '\u0627\u0644\u062f\u0642\u0647\u0644\u064a\u0629',
    'Kafr el-Sheikh': '\u0643\u0641\u0631 \u0627\u0644\u0634\u064a\u062e',
    'Kafr El Sheikh': '\u0643\u0641\u0631 \u0627\u0644\u0634\u064a\u062e',
    'Gharbia': '\u0627\u0644\u063a\u0631\u0628\u064a\u0629',
    'Monufia': '\u0627\u0644\u0645\u0646\u0648\u0641\u064a\u0629',
    'Al Sharqia': '\u0627\u0644\u0634\u0631\u0642\u064a\u0629',
    'Sharqia': '\u0627\u0644\u0634\u0631\u0642\u064a\u0629',
    'Ismailia': '\u0627\u0644\u0625\u0633\u0645\u0627\u0639\u064a\u0644\u064a\u0629',
    'Port Said': '\u0628\u0648\u0631\u0633\u0639\u064a\u062f',
    'Suez': '\u0627\u0644\u0633\u0648\u064a\u0633',
    'North Sinai': '\u0634\u0645\u0627\u0644 \u0633\u064a\u0646\u0627\u0621',
    'South Sinai': '\u062c\u0646\u0648\u0628 \u0633\u064a\u0646\u0627\u0621',
    'Faiyum': '\u0627\u0644\u0641\u064a\u0648\u0645',
    'Fayoum': '\u0627\u0644\u0641\u064a\u0648\u0645',
    'Beni Suef': '\u0628\u0646\u064a \u0633\u0648\u064a\u0641',
    'Minya': '\u0627\u0644\u0645\u0646\u064a\u0627',
    'Assiut': '\u0623\u0633\u064a\u0648\u0637',
    'Asyut': '\u0623\u0633\u064a\u0648\u0637',
    'Sohag': '\u0633\u0648\u0647\u0627\u062c',
    'Qena': '\u0642\u0646\u0627',
    'Luxor': '\u0627\u0644\u0623\u0642\u0635\u0631',
    'Aswan': '\u0623\u0633\u0648\u0627\u0646',
    'Red Sea': '\u0627\u0644\u0628\u062d\u0631 \u0627\u0644\u0623\u062d\u0645\u0631',
    'New Valley': '\u0627\u0644\u0648\u0627\u062f\u064a \u0627\u0644\u062c\u062f\u064a\u062f',
    'South Valley': '\u062c\u0646\u0648\u0628 \u0627\u0644\u0648\u0627\u062f\u064a',
  }

  return translations[name.trim()] ?? name
}
function pointInRing(
  longitude: number,
  latitude: number,
  ring: Position[],
): boolean {
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]

    const intersects =
      (yi > latitude) !== (yj > latitude) &&
      longitude <
        ((xj - xi) * (latitude - yi)) / (yj - yi) + xi

    if (intersects) inside = !inside
  }

  return inside
}

function pointInPolygon(
  longitude: number,
  latitude: number,
  rings: Position[][],
): boolean {
  if (!rings.length || !pointInRing(longitude, latitude, rings[0])) {
    return false
  }

  return !rings.slice(1).some((ring) =>
    pointInRing(longitude, latitude, ring),
  )
}

function pointInGovernorate(
  longitude: number,
  latitude: number,
  feature: GovernorateFeature,
): boolean {
  const { type, coordinates } = feature.geometry

  if (type === 'Polygon') {
    return pointInPolygon(
      longitude,
      latitude,
      coordinates as Position[][],
    )
  }

  return (coordinates as Position[][][]).some((polygon) =>
    pointInPolygon(longitude, latitude, polygon),
  )
}

const STATUS_COLORS: Record<string, string> = {
  submitted: '#64748b',
  ai_analyzed: '#8b5cf6',
  assigned: '#06b6d4',
  under_review: '#f59e0b',
  in_progress: '#3b82f6',
  resolved: '#16a34a',
  rejected: '#dc2626',
  duplicate: '#94a3b8',
  invalid: '#64748b',
  escalated: '#ea580c',
  manual_review_required: '#db2777',
}


const SEVERITY_COLORS: Record<string, string> = {
  Low: '#16a34a',
  Medium: '#eab308',
  High: '#f97316',
  Critical: '#dc2626',
}
const NO_SEVERITY_COLOR = '#94a3b8'
const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const
const NONE_VALUE = '__none__'

const EGYPT_BOUNDS: [[number, number], [number, number]] = [
  [21.5, 24.5],
  [31.9, 37.0],
]

function validCoordinates(report: Report): boolean {
  return (
    typeof report.latitude === 'number' &&
    Number.isFinite(report.latitude) &&
    report.latitude >= -90 &&
    report.latitude <= 90 &&
    typeof report.longitude === 'number' &&
    Number.isFinite(report.longitude) &&
    report.longitude >= -180 &&
    report.longitude <= 180
  )
}



function getGovernorateBounds(feature: GovernorateFeature) {
  const positions: Position[] = []

  function collectPositions(value: unknown): void {
    if (!Array.isArray(value)) return

    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      positions.push([value[0], value[1]])
      return
    }

    value.forEach(collectPositions)
  }

  collectPositions(feature.geometry.coordinates)

  if (positions.length === 0) return null

  const longitudes = positions.map(([longitude]) => longitude)
  const latitudes = positions.map(([, latitude]) => latitude)

  return [
    [
      Math.min(...latitudes),
      Math.min(...longitudes),
    ],
    [
      Math.max(...latitudes),
      Math.max(...longitudes),
    ],
  ] as [[number, number], [number, number]]
}


function MapViewController({
  governorates,
  governorateFilter,
  hasManualGovernorateSelection,
}: {
  governorates: GovernoratesData | null
  governorateFilter: string
  hasManualGovernorateSelection: boolean
}) {
  const map = useMap()
  const locationCenteredRef = useRef(false)
  const manualSelectionRef = useRef(hasManualGovernorateSelection)

  useEffect(() => {
    manualSelectionRef.current = hasManualGovernorateSelection
  }, [hasManualGovernorateSelection])

  // Try to center the map on the user's current device location once.
  useEffect(() => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (manualSelectionRef.current) return

        const { latitude, longitude } = position.coords

        // Keep the map within the configured Egypt bounds.
        if (
          latitude < EGYPT_BOUNDS[0][0] ||
          latitude > EGYPT_BOUNDS[1][0] ||
          longitude < EGYPT_BOUNDS[0][1] ||
          longitude > EGYPT_BOUNDS[1][1]
        ) {
          return
        }

        locationCenteredRef.current = true
        map.setView([latitude, longitude], 14, { animate: true })
      },
      (error) => {
        console.warn('Could not determine device location:', error.message)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    )
  }, [map])

  // Fit Egypt initially, unless device location succeeds.
  // A manual governorate selection always takes priority.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize()

      if (
        !hasManualGovernorateSelection &&
        governorateFilter === 'all' &&
        locationCenteredRef.current
      ) {
        return
      }

      if (governorateFilter === 'all') {
        map.fitBounds(EGYPT_BOUNDS, {
          padding: [10, 10],
          animate: false,
        })
        return
      }

      const feature = governorates?.features.find(
        (item) => item.properties.name === governorateFilter,
      )

      if (!feature) return

      const bounds = getGovernorateBounds(feature)

      if (bounds) {
        map.fitBounds(bounds, {
          padding: [25, 25],
          maxZoom: 10,
          animate: true,
        })
      }
    }, 150)

    return () => window.clearTimeout(timer)
  }, [
    map,
    governorates,
    governorateFilter,
    hasManualGovernorateSelection,
  ])

  return null
}
function translateDepartment(value: string, language: Language): string {
  if (language !== 'ar') return value

  const department = value.trim().toLowerCase()

  const translations: Record<string, string> = {
    'electricity / public lighting': '\u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621 / \u0625\u0646\u0627\u0631\u0629 \u0627\u0644\u0634\u0648\u0627\u0631\u0639',
    'municipal enforcement': '\u0627\u0644\u0631\u0642\u0627\u0628\u0629 \u0627\u0644\u0628\u0644\u062f\u064a\u0629',
    'parks / municipal services': '\u0627\u0644\u062d\u062f\u0627\u0626\u0642 / \u0627\u0644\u062e\u062f\u0645\u0627\u062a \u0627\u0644\u0628\u0644\u062f\u064a\u0629',
    'roads & infrastructure': '\u0627\u0644\u0637\u0631\u0642 \u0648\u0627\u0644\u0628\u0646\u064a\u0629 \u0627\u0644\u062a\u062d\u062a\u064a\u0629',
    'sanitation / utilities': '\u0627\u0644\u0635\u0631\u0641 \u0627\u0644\u0635\u062d\u064a / \u0627\u0644\u0645\u0631\u0627\u0641\u0642',
    'traffic management': '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0631\u0648\u0631',
    'waste management': '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u062e\u0644\u0641\u0627\u062a',
    'water & utilities': '\u0627\u0644\u0645\u064a\u0627\u0647 \u0648\u0627\u0644\u0645\u0631\u0627\u0641\u0642',
    'gas utilities': '\u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u063a\u0627\u0632',
    'emergency / public safety': '\u0627\u0644\u0637\u0648\u0627\u0631\u0626 / \u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0639\u0627\u0645\u0629',
    'stormwater drainage': '\u062a\u0635\u0631\u064a\u0641 \u0645\u064a\u0627\u0647 \u0627\u0644\u0623\u0645\u0637\u0627\u0631',
    'building inspection': '\u0627\u0644\u062a\u0641\u062a\u064a\u0634 \u0639\u0644\u0649 \u0627\u0644\u0645\u0628\u0627\u0646\u064a',
  }

  return translations[department] ?? value
}
function formatNumber(value: number, language: Language): string {
  return value.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB')
}
function formatDate(value: string, language: Language): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: language === 'ar',
  })
}

function GISMap({ language }: { language: Language }) {
  const t = (key: TranslationKey) => getTranslation(language, key)
  const [governorates, setGovernorates] =
    useState<GovernoratesData | null>(null)
  const [governorateFilter, setGovernorateFilter] = useState('all')
  const [hasManualGovernorateSelection, setHasManualGovernorateSelection] =
    useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadGovernorates() {
      try {
        const response = await fetch('/egypt-governorates.geojson')
        if (!response.ok) {
          throw new Error('Failed to load governorates: HTTP ' + response.status)
        }

        const data = (await response.json()) as GovernoratesData
        if (!cancelled) setGovernorates(data)
      } catch (error) {
        console.error('Could not load Egypt governorates:', error)
      }
    }

    void loadGovernorates()

    return () => {
      cancelled = true
    }
  }, [])

  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [view, setView] = useState<'map' | 'list'>('map')
  const [selected, setSelected] = useState<Report | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState('')
  const [editStatus, setEditStatus] = useState('submitted')
  const [editDepartment, setEditDepartment] = useState('')
  const [savingChanges, setSavingChanges] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (!selected) return
    setEditStatus(selected.status || 'submitted')
    setEditDepartment(selected.department || '')
  }, [selected?.id])

  useEffect(() => {
    setSaveError('')
    setSaveSuccess(false)
  }, [selected?.id])

  async function loadReports() {
    setLoading(true)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError || profile?.role !== 'admin') {
        throw new Error('Administrator access is required.')
      }

      const { data, error: reportsError } = await supabase
        .from('reports')
        .select(
          'id, report_code, category, status, severity, department, created_at, latitude, longitude, image_path, description',
        )
        .order('created_at', { ascending: false })

      if (reportsError) throw reportsError

      setReports((data ?? []) as Report[])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load reports.',
      )
    } finally {
      setLoading(false)
    }
  }

 useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadReports()
  }, 0)

  return () => window.clearTimeout(timer)
}, [])

  function uniqueCaseInsensitive(values: (string | null | undefined)[]): string[] {
    const unique = new Map<string, string>()

    values.forEach((value) => {
      const trimmed = value?.trim()
      if (!trimmed) return

      const key = trimmed.toLocaleLowerCase()
      if (!unique.has(key)) unique.set(key, trimmed)
    })

    return Array.from(unique.values()).sort((a, b) =>
      a.localeCompare(b),
    )
  }
  function canonicalizeCategory(value: string | null | undefined): string | null {
    const category = value?.trim()
    if (!category) return 'Uncategorized'

    const key = category.toLocaleLowerCase()

    const aliases: Record<string, string> = {
      'roads': 'Roads',
      'road': 'Roads',
      'pothole': 'Potholes',
      'potholes': 'Potholes',
      'road damage': 'Roads',
      'road maintenance': 'Roads',
      'pothole / road damage': 'Roads',

      'lighting': 'Street Lighting',
      'street lighting': 'Street Lighting',
      'streetlight': 'Street Lighting',
      'streetlights': 'Street Lighting',
      'broken streetlight': 'Street Lighting',

      'garbage': 'Garbage',
      'waste': 'Garbage',
      'trash': 'Garbage',
      'cleanliness': 'Garbage',

      'water': 'Water',
      'water leak': 'Water',
      'sanitation': 'Sanitation',
      'sewage': 'Sanitation',

      'parking': 'Parking',
      'illegal parking': 'Parking',

      'building': 'Buildings',
      'buildings': 'Buildings',

      'tree': 'Trees',
      'trees': 'Trees',
      'fallen tree': 'Trees',

      'encroachment': 'Encroachment',
      'illegal encroachment': 'Encroachment',

      'sidewalk': 'Sidewalks',
      'sidewalks': 'Sidewalks',
      'other': 'Other',
      'other / unrecognized civic issue': 'Other',
      'uncategorized': 'Uncategorized',
      'unknown': 'Uncategorized',
    }

    return aliases[key] ?? category
  }
  const KNOWN_CATEGORIES = [
    'Roads',
    'Potholes',
    'Street Lighting',
    'Garbage',
    'Sanitation',
    'Water',
    'Electricity',
    'Traffic',
    'Parking',
    'Obstruction',
    'Sidewalks',
    'Public Safety',
    'Safety',
    'Buildings',
    'Trees',
    'Encroachment',
    'Noise',
    'Animals',
    'Parks',
    'Public Spaces',
    'Construction Debris',
    'Flooding',
    'Graffiti',
    'Open Manhole',
    'Traffic Sign',
    'Other',
    'Uncategorized',
  ]

  const KNOWN_DEPARTMENTS = [
    'Electricity / Public Lighting',
    'Municipal Enforcement',
    'Parks / Municipal Services',
    'Roads & Infrastructure',
    'Sanitation / Utilities',
    'Traffic Management',
    'Waste Management',
    'Water & Utilities',
    'Gas Utilities',
    'Emergency / Public Safety',
    'Stormwater Drainage',
    'Building Inspection',
  ]

  const categories = useMemo(
    () =>
      uniqueCaseInsensitive([
        ...KNOWN_CATEGORIES,
        ...reports.map((report) => canonicalizeCategory(report.category)),
      ]),
    [reports],
  )

  const departments = useMemo(
    () =>
      uniqueCaseInsensitive([
        ...KNOWN_DEPARTMENTS,
        ...reports.map((report) => report.department),
      ]),
    [reports],
  )

  const filteredReports = useMemo(() => {
    const selectedGovernorate =
      governorates?.features.find(
        (feature) => feature.properties.name === governorateFilter,
      ) ?? null

    return reports.filter((report) => {
      if (statusFilter !== 'all' && report.status !== statusFilter) {
        return false
      }

      if (categoryFilter !== 'all' && canonicalizeCategory(report.category) !== categoryFilter) {
        return false
      }

      if (severityFilter !== 'all') {
        if (severityFilter === NONE_VALUE) {
          if (report.severity !== null) return false
        } else if (report.severity !== severityFilter) {
          return false
        }
      }

      if (departmentFilter !== 'all') {
        if (departmentFilter === NONE_VALUE) {
          if (report.department) return false
        } else if (report.department !== departmentFilter) {
          return false
        }
      }

      if (!validCoordinates(report)) {
        return true
      }

      const longitude = report.longitude!
      const latitude = report.latitude!

      // Exclude reports outside all Egyptian governorates.
      const containingGovernorate = governorates?.features.find((feature) =>
        pointInGovernorate(longitude, latitude, feature),
      )

      if (governorates && !containingGovernorate) {
        return false
      }

      if (selectedGovernorate) {
        return pointInGovernorate(longitude, latitude, selectedGovernorate)
      }

      return true
    })
  }, [
    reports,
    statusFilter,
    categoryFilter,
    severityFilter,
    departmentFilter,
    governorateFilter,
    governorates,
  ])

  const mappedReports = useMemo(
    () => filteredReports.filter(validCoordinates),
    [filteredReports],
  )
  async function viewImage(report: Report) {
    setImageUrl('')
    setImageError('')
    setImageLoading(true)

    try {
      if (!report.image_path) {
        throw new Error('This report has no stored image path.')
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError || profile?.role !== 'admin') {
        throw new Error('Administrator access is required.')
      }

      const { data, error: storageError } = await supabase.storage
        .from('report-images')
        .createSignedUrl(report.image_path, 120)

      if (storageError) throw storageError

      setImageUrl(data.signedUrl)
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : 'Unable to load the image.',
      )
    } finally {
      setImageLoading(false)
    }
  }

  async function saveReportChanges() {
    if (!selected || savingChanges) return

    setSavingChanges(true)
    setSaveError('')
    setSaveSuccess(false)

    try {
      const { data, error: updateError } = await supabase
        .from('reports')
        .update({
          status: editStatus,
          department: editDepartment || null,
        })
        .eq('id', selected.id)
        .select(
          'id, report_code, category, status, severity, department, created_at, latitude, longitude, image_path, description',
        )
        .single()

      if (updateError) throw updateError

      const updatedReport = data as Report

      setReports((current) =>
        current.map((report) =>
          report.id === updatedReport.id ? updatedReport : report,
        ),
      )
      setSelected(updatedReport)
      setSaveSuccess(true)
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : language === 'ar'
            ? '\u062a\u0639\u0630\u0631 \u062d\u0641\u0638 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a.'
            : 'Unable to save changes.',
      )
    } finally {
      setSavingChanges(false)
    }
  }

  return (
    <section className="gis-section">
      <div className="gis-header">
        <div>
          
          <p className="page-description">{t('mapDescription')}</p>
        </div>
        <button
          className="gis-refresh"
          type="button"
          onClick={() => void loadReports()}
          disabled={loading}
        >
          {loading ? t('loading') : t('refreshReports')}
        </button>
      </div>

      <div className="gis-metrics">
        <div className="gis-metric">
          <span>{t('matchingReports')}</span>
          <strong>{formatNumber(filteredReports.length, language)}</strong>
        </div>
        <div className="gis-metric">
          <span>{t('mappedReports')}</span>
          <strong>{formatNumber(mappedReports.length, language)}</strong>
        </div>
        
      </div>

     <div className="gis-filters">
        <label>
          {t('status')}
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">{t('allStatuses')}</option>
            {uniqueCaseInsensitive([
              ...Object.keys(STATUS_COLORS),
              ...reports.map((report) => report.status),
            ]).map((status) => (
                <option key={status} value={status}>
                  {translateStatus(status, language)}
                </option>
              ))}
          </select>
        </label>

        <label>
          {t('category')}
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">{t('allCategories')}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {translateCategory(category, language)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t('severity')}
          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
          >
            <option value="all">{t('allSeverities')}</option>
            {SEVERITY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {translateSeverity(level, language)}
              </option>
            ))}
            <option value={NONE_VALUE}>{t('notAnalyzed')}</option>
          </select>
        </label>

        <label>
          {t('department')}
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
          >
            <option value="all">{t('allDepartments')}</option>
            {departments.map((department) => (
              <option key={department} value={department}>{translateDepartment(department, language)}</option>
            ))}
            <option value={NONE_VALUE}>{t('unassigned')}</option>
          </select>
        </label>

        <label>
          {t('governorate')}
          <select
            value={governorateFilter}
            onChange={(event) => {
              setHasManualGovernorateSelection(true)
              setGovernorateFilter(event.target.value)
            }}
            disabled={!governorates}
          >
            <option value="all">{t('allEgypt')}</option>
            {[...(governorates?.features ?? [])]
              .sort((a, b) =>
                a.properties.name.localeCompare(b.properties.name),
              )
              .map((feature) => (
                <option
                  key={feature.properties.name}
                  value={feature.properties.name}
                >
                  {translateGovernorate(feature.properties.name, language)}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="gis-view-toggle" role="group" aria-label={t('reports')}>
        <button
          type="button"
          className={view === 'map' ? 'active' : ''}
          aria-pressed={view === 'map'}
          onClick={() => setView('map')}
        >
          {t('mapView')}
        </button>
        <button
          type="button"
          className={view === 'list' ? 'active' : ''}
          aria-pressed={view === 'list'}
          onClick={() => setView('list')}
        >
          {t('listView')}
        </button>
      </div>

      {error && (
        <div className="gis-error" role="alert">
          <strong>Could not load reports.</strong>
          <p>{error}</p>
          <p>Check your session, Supabase configuration, and admin RLS policies.</p>
        </div>
      )}

      {view === 'map' && (
      <>
      <div className="gis-map-frame">
        {loading && reports.length === 0 && !error ? (
          <div className="gis-loading">{language === 'ar' ? '\u062c\u0627\u0631\u064d \u062a\u062d\u0645\u064a\u0644 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0628\u0644\u0627\u063a\u0627\u062a...' : 'Loading report data...'}</div>
        ) : (
         
	<MapContainer
  bounds={EGYPT_BOUNDS}
  zoomSnap={0.25}
  maxZoom={18}
  maxBounds={EGYPT_BOUNDS}
  maxBoundsViscosity={1}
  scrollWheelZoom
  className="gis-map"
>

           
<MapViewController
  governorates={governorates}
  governorateFilter={governorateFilter}
  hasManualGovernorateSelection={hasManualGovernorateSelection}
/>

<TileLayer
  attribution='&copy; OpenStreetMap contributors'
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
/>


{/* Reports */}
{mappedReports.map((report) => {
  const isSelected = selected?.id === report.id
  const statusColor = STATUS_COLORS[report.status ?? ''] ?? '#64748b'
  const severityColor = SEVERITY_COLORS[report.severity ?? ''] ?? NO_SEVERITY_COLOR

  const pinIcon = L.divIcon({
    className: 'civicguard-pin-wrapper',
    html: `<div style="width:${isSelected ? 42 : 34}px;height:${isSelected ? 52 : 44}px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="100%" height="100%">
        <path d="M16 1.5 C8.1 1.5 2 7.6 2 15 C2 25 16 40 16 40 S30 25 30 15 C30 7.6 23.9 1.5 16 1.5Z" fill="${severityColor}" stroke="${statusColor}" stroke-width="${isSelected ? 3.5 : 2.5}" stroke-linejoin="round"/>
                <circle cx="16" cy="15" r="${isSelected ? 6 : 5}" fill="#ffffff" stroke="${statusColor}" stroke-width="1.5"/>

      </svg>
    </div>`,
    iconSize: isSelected ? [42, 52] : [34, 44],
    iconAnchor: isSelected ? [21, 50] : [17, 42],
    popupAnchor: [0, isSelected ? -49 : -41],
  })

  return (
    <Marker
      key={report.id}
      position={[report.latitude!, report.longitude!]}
      icon={pinIcon}
      eventHandlers={{
        click: () => {
          setSelected(report)
          setImageUrl('')
          setImageError('')
        },
      }}
    >
      <Popup>
        <strong>{report.report_code || report.id}</strong>
        <br />
        {report.category ? translateCategory(report.category, language) : t('uncategorized')}
        <br />
        {t('status')}: {report.status ? translateStatus(report.status, language) : t('unknown')}
        <br />
        {t('severity')}: {report.severity ? translateSeverity(report.severity, language) : t('notAnalyzed')}
        <br />
        <button
          type="button"
          onClick={() => {
            setSelected(report)
            setImageUrl('')
            setImageError('')
          }}
        >
          {getTranslation(language, 'viewDetails')}
        </button>
      </Popup>
    </Marker>
  )
})}
</MapContainer>

        )}
      </div>

      <div className="gis-legend">
        <strong>{t('severity')}</strong>
        {SEVERITY_LEVELS.map((level) => (
          <span key={level} className="gis-legend-item">
            <i style={{ backgroundColor: SEVERITY_COLORS[level] }} />
            {translateSeverity(level, language)}
          </span>
        ))}
        <span className="gis-legend-item">
          <i style={{ backgroundColor: NO_SEVERITY_COLOR }} />
          {t('notAnalyzed')}
        </span>
      </div>

      <div className="gis-legend">
        <strong>{t('reportStatus')}</strong>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="gis-legend-item">
            <i
              style={{
                backgroundColor: 'transparent',
                border: `3px solid ${color}`,
                boxSizing: 'border-box',
              }}
            />
            {translateStatus(status, language)}
          </span>
        ))}
      </div>

      {mappedReports.length === 0 && !loading && !error && (
        <p className="gis-notice">{t('noMatchingMapReports')}</p>
      )}

      </>
      )}

      {view === 'list' && (
        <div className="gis-table-wrap">
          {filteredReports.length === 0 ? (
            <p className="gis-notice">{t('noReportsMatch')}</p>
          ) : (
            <table className="gis-table">
              <thead>
                <tr>
                  <th>{t('reportCode')}</th>
                  <th>{t('category')}</th>
                  <th>{t('severity')}</th>
                  <th>{t('status')}</th>
                  <th>{t('department')}</th>
                  <th>{t('date')}</th>
                  {/* ACTIONS_COLUMN_ADDED */}
                  <th>{language === 'ar' ? '\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className={selected?.id === report.id ? 'selected' : ''}
                    tabIndex={0}
                    onClick={() => {
                      setSelected(report)
                      setImageUrl('')
                      setImageError('')
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelected(report)
                        setImageUrl('')
                        setImageError('')
                      }
                    }}
                  >
                    <td>{report.report_code || report.id}</td>
                    <td>
                      {report.category
                        ? translateCategory(report.category, language)
                        : t('uncategorized')}
                    </td>
                    <td>
                      <span className="gis-sev">
                        <i
                          style={{
                            backgroundColor:
                              SEVERITY_COLORS[report.severity ?? ''] ??
                              NO_SEVERITY_COLOR,
                          }}
                        />
                        {report.severity
                          ? translateSeverity(report.severity, language)
                          : t('notAnalyzed')}
                      </span>
                    </td>
                    <td>
                      {report.status
                        ? translateStatus(report.status, language)
                        : t('unknown')}
                    </td>
                    <td>{report.department ? translateDepartment(report.department, language) : t('unassigned')}</td>
                    <td>{formatDate(report.created_at, language)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelected(report)
                          setImageUrl('')
                          setImageError('')
                        }}
                      >
                        {getTranslation(language, 'viewDetails')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selected && (
        <div
          className="gis-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelected(null)
              setImageUrl('')
              setImageError('')
            }
          }}
        >
          <section
            className="gis-details gis-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gis-modal-title"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          >
            <div className="gis-details-header">
              <div>
                <h3 id="gis-modal-title">
                  {getTranslation(language, 'reportDetails')}
                </h3>
                <p className="gis-modal-subtitle">
                  {getTranslation(language, 'reportDetailsSubtitle')}
                </p>
              </div>
              <button
                type="button"
                className="gis-close"
                aria-label={getTranslation(language, 'closeReportDetails')}
                onClick={() => setSelected(null)}
              >
                {String.fromCharCode(215)}
              </button>
            </div>

            <div className="gis-report-code">
              <span>{getTranslation(language, 'reportCode')}</span>
              <strong>{selected.report_code || selected.id}</strong>
            </div>

            <div className="gis-modal-grid">
              <div className="gis-info-card">
                <span className="gis-info-label">
                  {getTranslation(language, 'location')}
                </span>
                <strong>
                  {validCoordinates(selected)
                    ? governorates?.features.find((feature) =>
                        pointInGovernorate(
                          selected.longitude as number,
                          selected.latitude as number,
                          feature,
                        ),
                      )?.properties.name ||
                      getTranslation(language, 'locationUnavailable')
                    : getTranslation(language, 'locationUnavailable')}
                </strong>
              </div>

              <div className="gis-info-card">
                <span className="gis-info-label">
                  {getTranslation(language, 'description')}
                </span>
                <p>
                  {selected.description ||
                    getTranslation(language, 'noDescription')}
                </p>
              </div>
            </div>

            <div className="gis-modal-meta">
              <div>
                <span>{getTranslation(language, 'category')}</span>
                <strong>
                  {selected.category
                    ? translateCategory(selected.category, language)
                    : getTranslation(language, 'notSpecified')}
                </strong>
              </div>
              <div>
                <span>{getTranslation(language, 'status')}</span>
                <strong>
                  {selected.status
                    ? translateStatus(selected.status, language)
                    : getTranslation(language, 'unknown')}
                </strong>
              </div>
              <div>
                <span>{getTranslation(language, 'severity')}</span>
                <strong>
                  {selected.severity
                    ? translateSeverity(selected.severity, language)
                    : getTranslation(language, 'notAnalyzed')}
                </strong>
              </div>
              <div>
                <span>{getTranslation(language, 'department')}</span>
                <strong>
                  {selected.department
                    ? translateDepartment(selected.department, language)
                    : getTranslation(language, 'unassigned')}
                </strong>
              </div>
              <div>
                <span>{getTranslation(language, 'created')}</span>
                <strong>
                  {new Date(selected.created_at).toLocaleDateString(
                    language === 'ar' ? 'ar-EG' : 'en-GB',
                    { timeZone: 'Africa/Cairo', year: 'numeric', month: 'long', day: 'numeric' }
                  )}
                </strong>
              </div>
              <div>
                <span>{getTranslation(language, 'time')}</span>
                <strong>
                  {new Date(selected.created_at).toLocaleTimeString(
                    language === 'ar' ? 'ar-EG' : 'en-GB',
                    { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hour12: true }
                  )}
                </strong>
              </div>
            </div>

            <div
              className="gis-edit-controls"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
                marginTop: '20px',
                padding: '16px',
                border: '1px solid var(--border-color, #dbe2ea)',
                borderRadius: '12px',
              }}
            >
              <label style={{ display: 'grid', gap: '7px', fontWeight: 600 }}>
                {language === 'ar'
                  ? '\u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u062d\u0627\u0644\u0629'
                  : 'Change status'}
                <select
                  value={editStatus}
                  onChange={(event) => {
                    setEditStatus(event.target.value)
                    setSaveError('')
                    setSaveSuccess(false)
                  }}
                  disabled={savingChanges}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px' }}
                >
                  {[
                    'submitted',
                    'ai_analyzed',
                    'assigned',
                    'under_review',
                    'in_progress',
                    'resolved',
                    'rejected',
                    'duplicate',
                    'invalid',
                    'escalated',
                    'manual_review_required',
                  ].map((status) => (
                    <option key={status} value={status}>
                      {translateStatus(status, language)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: '7px', fontWeight: 600 }}>
                {getTranslation(language, 'department')}
                <select
                  value={editDepartment}
                  onChange={(event) => {
                    setEditDepartment(event.target.value)
                    setSaveError('')
                    setSaveSuccess(false)
                  }}
                  disabled={savingChanges}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px' }}
                >
                  <option value="">
                    {getTranslation(language, 'unassigned')}
                  </option>
                  {[
                    ...KNOWN_DEPARTMENTS,
                    ...(selected.department &&
                    !KNOWN_DEPARTMENTS.includes(selected.department)
                      ? [selected.department]
                      : []),
                  ].map((department) => (
                    <option key={department} value={department}>
                      {translateDepartment(department, language)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => void viewImage(selected)}
              disabled={imageLoading}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                cursor: imageLoading ? 'wait' : 'pointer',
                minHeight: '34px',
                marginTop: '12px',
                marginBottom: '0px',
              }}
            >
              {imageLoading
                ? getTranslation(language, 'loadingImage')
                : getTranslation(language, 'viewOriginalImage')}
            </button>



              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="gis-image-button"
                  onClick={() => void saveReportChanges()}
                  disabled={savingChanges}
                  style={{
                    padding: '11px 20px',
                    borderRadius: '8px',
                    cursor: savingChanges ? 'wait' : 'pointer',
                    minHeight: '42px',
                    marginBottom: '6px',
                  }}
                >
                  {savingChanges
                    ? language === 'ar'
                      ? '\u062c\u0627\u0631\u064a \u0627\u0644\u062d\u0641\u0638...'
                      : 'Saving...'
                    : language === 'ar'
                      ? '\u062d\u0641\u0638 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a'
                      : 'Save changes'}
                </button>

                {saveError && (
                  <p role="alert" style={{ color: '#dc2626', marginTop: '10px' }}>
                    {language === 'ar'
                      ? '\u0641\u0634\u0644 \u0627\u0644\u062d\u0641\u0638: '
                      : 'Save failed: '}
                    {saveError}
                  </p>
                )}

                {saveSuccess && (
                  <p role="status" style={{ color: '#16a34a', marginTop: '10px' }}>
                    {language === 'ar'
                      ? '\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a \u0628\u0646\u062c\u0627\u062d.'
                      : 'Changes saved successfully.'}
                  </p>
                )}
              </div>

            {imageError && (
              <p className="gis-error" role="alert">{imageError}</p>
            )}

          </section>
        </div>
      )}

      {imageUrl && selected && (
        <div
          className="gis-image-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={getTranslation(language, 'originalEvidence')}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setImageUrl('')
            }
          }}
        >
          <section className="gis-image-modal">
            <div className="gis-image-modal-header">
              <h3>
                {getTranslation(language, 'originalEvidence')}
              </h3>
              <button
                type="button"
                className="gis-close"
                aria-label={getTranslation(language, 'closeReportDetails')}
                onClick={() => setImageUrl('')}
              >
                {String.fromCharCode(215)}
              </button>
            </div>
            <img
              src={imageUrl}
              alt={`${getTranslation(language, 'originalEvidence')} ${selected.report_code || selected.id}`}
            />
            <p>{getTranslation(language, 'imageExpiry')}</p>
          </section>
        </div>
      )}
    </section>
  )
}

export default GISMap
