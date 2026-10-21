
import { useEffect, useMemo, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import { supabase } from './lib/supabase'
import 'leaflet/dist/leaflet.css'
import './GISMap.css'

type Report = {
  id: string
  report_code: string | null
  category: string | null
  status: string | null
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize()

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
  }, [map, governorates, governorateFilter, hasManualGovernorateSelection])

  return null
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function GISMap() {
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
  const [selected, setSelected] = useState<Report | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState('')

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
          'id, report_code, category, status, created_at, latitude, longitude, image_path, description',
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

  const categories = useMemo(
    () =>
      [...new Set(
        reports
          .map((report) => report.category)
          .filter((category): category is string => Boolean(category)),
      )].sort(),
    [reports],
  )

  const filteredReports = useMemo(() => {
  const selectedGovernorate =
    governorates?.features.find(
      (feature) => feature.properties.name === governorateFilter,
    ) ?? null

  return reports.filter((report) => {
    if (
      statusFilter !== 'all' &&
      report.status !== statusFilter
    ) {
      return false
    }

    if (
      categoryFilter !== 'all' &&
      report.category !== categoryFilter
    ) {
      return false
    }

    if (!validCoordinates(report)) {
      return true
    }

    const longitude = report.longitude!
    const latitude = report.latitude!

    // Exclude reports outside all Egyptian governorates.
    const containingGovernorate = governorates?.features.find(
      (feature) =>
        pointInGovernorate(longitude, latitude, feature),
    )

    if (governorates && !containingGovernorate) {
      return false
    }

    if (selectedGovernorate) {
      return (
        pointInGovernorate(
          longitude,
          latitude,
          selectedGovernorate,
        )
      )
    }

    return true
  })
}, [reports, statusFilter, categoryFilter, governorateFilter, governorates])

  const mappedReports = useMemo(
    () => filteredReports.filter(validCoordinates),
    [filteredReports],
  )

  const missingCoordinates = filteredReports.length - mappedReports.length

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

  return (
    <section className="gis-section">
      <div className="gis-header">
        <div>
          <h2>GIS Map — Report Map</h2>
          <p>Geographic view of real reports stored in CivicGuard.</p>
        </div>
        <button
          className="gis-refresh"
          type="button"
          onClick={() => void loadReports()}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh reports'}
        </button>
      </div>

      <div className="gis-metrics">
        <div className="gis-metric">
          <span>Matching reports</span>
          <strong>{filteredReports.length}</strong>
        </div>
        <div className="gis-metric">
          <span>Mapped reports</span>
          <strong>{mappedReports.length}</strong>
        </div>
        <div className="gis-metric">
          <span>Missing coordinates</span>
          <strong>{missingCoordinates}</strong>
        </div>
      </div>

     <div className="gis-filters">
  <label>
    Status
    <select
      value={statusFilter}
      onChange={(event) => setStatusFilter(event.target.value)}
    >
      <option value="all">All statuses</option>
      {[...new Set(reports.map((report) => report.status).filter(Boolean))]
        .sort()
        .map((status) => (
          <option key={status} value={status!}>
            {status!.replaceAll('_', ' ')}
          </option>
        ))}
    </select>
  </label>

  <label>
    Category
    <select
      value={categoryFilter}
      onChange={(event) => setCategoryFilter(event.target.value)}
    >
      <option value="all">All categories</option>
      {categories.map((category) => (
        <option key={category} value={category}>
          {category.replaceAll('_', ' ')}
        </option>
      ))}
    </select>
  </label>

  <label>
    Governorate
    <select
      value={governorateFilter}
      onChange={(event) => {
  setHasManualGovernorateSelection(true)
  setGovernorateFilter(event.target.value)
}}
      disabled={!governorates}
    >
      <option value="all">All Egypt</option>
      {[...(governorates?.features ?? [])]
        .sort((a, b) =>
          a.properties.name.localeCompare(b.properties.name),
        )
        .map((feature) => (
          <option
            key={feature.properties.name}
            value={feature.properties.name}
          >
            {feature.properties.name}
          </option>
        ))}
    </select>
  </label>
</div>

      {error && (
        <div className="gis-error" role="alert">
          <strong>Could not load reports.</strong>
          <p>{error}</p>
          <p>Check your session, Supabase configuration, and admin RLS policies.</p>
        </div>
      )}

      <div className="gis-map-frame">
        {loading && reports.length === 0 && !error ? (
          <div className="gis-loading">Loading report data...</div>
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
{mappedReports.map((report) => (
  <CircleMarker
    key={report.id}
    center={[report.latitude!, report.longitude!]}
    radius={selected?.id === report.id ? 10 : 7}
    pathOptions={{
      color: '#ffffff',
      weight: 2,
      fillColor: STATUS_COLORS[report.status ?? ''] ?? '#64748b',
      fillOpacity: 0.9,
    }}
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
      {report.category || 'Uncategorized'}
      <br />
      Status: {report.status || 'Unknown'}
      <br />
      <button
        type="button"
        onClick={() => {
          setSelected(report)
          setImageUrl('')
          setImageError('')
        }}
      >
        View details
      </button>
    </Popup>
  </CircleMarker>
))}
</MapContainer>

        )}
      </div>

      <div className="gis-legend">
        <strong>Report status</strong>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="gis-legend-item">
            <i style={{ backgroundColor: color }} />
            {status.replaceAll('_', ' ')}
          </span>
        ))}
      </div>

      {mappedReports.length === 0 && !loading && !error && (
        <p className="gis-notice">
          No reports with valid coordinates match the selected filters. Reports
          without coordinates are counted above but cannot be plotted.
        </p>
      )}

      {selected && (
        <div className="gis-details">
          <div className="gis-details-header">
            <h3>Report details</h3>
            <button
              type="button"
              className="gis-close"
              onClick={() => {
                setSelected(null)
                setImageUrl('')
                setImageError('')
              }}
            >
              Close
            </button>
          </div>

          <dl>
            <dt>Report code</dt>
            <dd>{selected.report_code || selected.id}</dd>

            <dt>Category</dt>
            <dd>{selected.category || 'Not specified'}</dd>

            <dt>Status</dt>
            <dd>{selected.status || 'Unknown'}</dd>

            <dt>Created</dt>
            <dd>{formatDate(selected.created_at)}</dd>

            <dt>Coordinates</dt>
            <dd>
              {validCoordinates(selected)
                ? `${selected.latitude}, ${selected.longitude}`
                : 'Not available'}
            </dd>

            <dt>Description</dt>
            <dd>{selected.description || 'No description provided.'}</dd>
          </dl>

          <button
            type="button"
            className="gis-image-button"
            onClick={() => void viewImage(selected)}
            disabled={imageLoading}
          >
            {imageLoading ? 'Loading image...' : 'View original image'}
          </button>

          {imageError && (
            <p className="gis-error" role="alert">
              {imageError}
            </p>
          )}

          {imageUrl && (
            <div className="gis-image-preview">
              <img
                src={imageUrl}
                alt={`Original evidence for ${selected.report_code || selected.id}`}
              />
              <p>Temporary secure link; it expires after approximately 120 seconds.</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default GISMap


