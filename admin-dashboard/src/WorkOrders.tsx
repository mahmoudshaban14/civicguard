import { useMemo, useState } from 'react'
import {
  ClipboardList, Search, Plus, Clock3, AlertTriangle,
  Wrench, MapPin, UserRound, X,
  ShieldCheck, Eye, ChevronDown, FileText,
  RotateCcw, Filter, Image as ImageIcon,
  CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Layers,
  Info
} from 'lucide-react'
import type { Language } from './i18n'
import { translateCategory, translateDepartment } from './i18n'
import './WorkOrders.css'

export type WorkStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'pending_verification'
  | 'completed'
  | 'cancelled'

export type Priority =
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Critical'

export type Report = {
  id: string
  report_code: string
  user_id?: string | null
  category: string | null
  image_description: string | null
  status: string
  severity?: string | null
  department?: string | null
  description?: string | null
  latitude?: number | null
  longitude?: number | null
  image_path?: string | null
  confidence?: number | null
  explanation?: string | null
  requires_manual_review?: boolean | null
  created_at: string
  updated_at?: string
}

export type WorkOrder = {
  id: string
  reference: string
  report_id: string
  reportCode?: string
  title: string
  department: string
  department_id?: string
  assignee?: string | null
  assigned_to?: string | null
  priority: Priority
  status: WorkStatus
  created_at: string
  target_completion_at?: string | null
  description?: string | null
  before_image_path?: string | null
  after_image_path?: string | null
  evidence_note?: string | null
  events?: { title: string; date: string; note?: string }[]
}

export type WorkOrdersProps = {
  language: Language
  reports: Report[]
  reportsLoading: boolean
  reportsError: string
}

const copy = {
  en: {
    title: 'Work Orders',
    subtitle: 'Track field assignments, dispatch teams, and inspect verified repairs.',
    create: 'New Work Order',
    total: 'Total Orders',
    inProgress: 'In Progress',
    pendingVerification: 'Awaiting Review',
    completed: 'Completed',
    searchPlaceholder: 'Search by reference, report code, title, or department...',
    statusFilter: 'Status',
    priorityFilter: 'Priority',
    departmentFilter: 'Department',
    allStatuses: 'All Statuses',
    allPriorities: 'All Priorities',
    allDepartments: 'All Departments',
    resetFilters: 'Reset filters',
    reference: 'Reference',
    relatedReport: 'Related Report',
    titleCol: 'Title',
    departmentCol: 'Department',
    assigneeCol: 'Assignee',
    priorityCol: 'Priority',
    statusCol: 'Status',
    createdAtCol: 'Created At',
    targetCompletionCol: 'Target Date',
    actionsCol: 'Actions',
    viewDetails: 'View Details',
    noOrdersTitle: 'No Work Orders Found',
    noOrdersDescription: 'No work orders have been created or returned by the system yet. Once connected to the backend API, active tasks will appear here.',
    noMatchingTitle: 'No Matching Work Orders',
    noMatchingDescription: 'Try adjusting your search criteria or resetting the active filters.',
    apiNoticeTitle: 'Backend Integration Pending',
    apiNoticeDesc: 'Creation of work orders is currently disabled because the backend API integration is in progress. The form below is available for UI review and testing.',
    createTitle: 'Create Work Order',
    createSubtitle: 'Associate a work order with an existing citizen infrastructure report.',
    selectReportSection: '1. Select Associated Report',
    searchReportPlaceholder: 'Filter reports by code, category, or description...',
    selectReportPrompt: '-- Select a verified report --',
    selectedReportBadge: 'Selected Report Preview',
    woDetailsSection: '2. Work Order Specifications',
    woTitleLabel: 'Work Order Title',
    woTitlePlaceholder: 'e.g., Road resurfacing and asphalt compaction',
    woDescLabel: 'Operational Instructions (Optional)',
    woDescPlaceholder: 'Provide specific instructions or precautions for the field crew...',
    woDeptLabel: 'Responsible Department',
    woPriorityLabel: 'Priority Level',
    woDueDateLabel: 'Target Completion Date (Optional)',
    submitCreate: 'Create Work Order',
    creationDisabledReason: 'Submission is temporarily disabled pending backend API integration.',
    cancel: 'Cancel',
    close: 'Close',
    unassigned: 'Unassigned',
    detailsTitle: 'Work Order Details',
    reportDetails: 'Report Details',
    citizenDescription: 'Citizen Description',
    aiDescription: 'AI Detection & Analysis',
    location: 'Location Coordinates',
    viewOnMap: 'View on Google Maps',
    notAvailable: 'Not available',
    evidenceSection: 'Repair Verification Evidence',
    beforeImage: 'Initial Report Photo',
    afterImage: 'Completed Repair Photo',
    noAfterImage: 'No repair evidence uploaded yet.',
    evidenceNote: 'Completion Notes',
    noEvidenceNote: 'No completion notes provided yet.',
    timelineSection: 'Audit & Lifecycle Timeline',
    noEvents: 'No activity recorded yet.',
    loadingReports: 'Loading reports...',
    reportsLoadError: 'Unable to load reports for association.',
    duplicateReportNotice: 'Duplicate protection notice: The database and backend will enforce that only 1 active work order may exist per report. Duplicate creation attempts will be rejected by the server (HTTP 409).',
    requireReport: 'Please select a report to associate with this work order.',
    requireTitle: 'Please provide a descriptive work order title.',
    statsUnavailable: 'Pending API',
    locationAvailable: 'Location available',
    viewOriginal: 'View Original',
    evidenceBadge: 'VERIFIED EVIDENCE',
    pendingBadge: 'AWAITING UPLOAD',
    authorizedImagePending: 'Image preview will be loaded via authorized signed URLs once the Work Orders API is connected.',
  },
  ar: {
    title: 'أوامر العمل',
    subtitle: 'متابعة المهام الميدانية، وتكليف الفرق، والتحقق من الإصلاحات المكتملة.',
    create: 'أمر عمل جديد',
    total: 'إجمالي الأوامر',
    inProgress: 'قيد التنفيذ',
    pendingVerification: 'بانتظار المراجعة',
    completed: 'مكتملة',
    searchPlaceholder: 'البحث برقم الأمر، رقم البلاغ، العنوان، أو الجهة...',
    statusFilter: 'الحالة',
    priorityFilter: 'الأولوية',
    departmentFilter: 'الجهة المختصة',
    allStatuses: 'كل الحالات',
    allPriorities: 'كل الأولويات',
    allDepartments: 'كل الجهات',
    resetFilters: 'إعادة ضبط الفلاتر',
    reference: 'رقم الأمر',
    relatedReport: 'البلاغ المرتبط',
    titleCol: 'العنوان',
    departmentCol: 'الجهة المختصة',
    assigneeCol: 'المسؤول',
    priorityCol: 'الأولوية',
    statusCol: 'الحالة',
    createdAtCol: 'تاريخ الإنشاء',
    targetCompletionCol: 'موعد التسليم المستهدف',
    actionsCol: 'الإجراءات',
    viewDetails: 'عرض التفاصيل',
    noOrdersTitle: 'لا توجد أوامر عمل حاليًا',
    noOrdersDescription: 'لم يتم إنشاء أي أوامر عمل أو استرجاعها من الخادم بعد. ستظهر المهام الميدانية فور تفعيل الربط مع واجهة البرمجة (API).',
    noMatchingTitle: 'لا توجد أوامر عمل مطابقة',
    noMatchingDescription: 'جرّب تعديل معايير البحث أو إعادة ضبط الفلاتر المحددة.',
    apiNoticeTitle: 'الربط البرمجي مع الخادم قيد الإعداد',
    apiNoticeDesc: 'تم إيقاف زر الإنشاء مؤقتًا لأن واجهة البرمجة (API) الخاصة بأوامر العمل لا تزال قيد الإعداد في الواجهة الخلفية. النموذج متاح لمعاينة واجهة المستخدم واختبارها.',
    createTitle: 'إنشاء أمر عمل جديد',
    createSubtitle: 'ربط مهمة العمل الميدانية ببلاغ بنية تحتية مسجل في النظام.',
    selectReportSection: '١. اختيار البلاغ المرتبط',
    searchReportPlaceholder: 'تصفية البلاغات برقم البلاغ، التصنيف، أو الوصف...',
    selectReportPrompt: '-- اختر بلاغًا مؤكدًا --',
    selectedReportBadge: 'معاينة البلاغ المختار',
    woDetailsSection: '٢. بيانات أمر العمل',
    woTitleLabel: 'عنوان أمر العمل',
    woTitlePlaceholder: 'مثال: صيانة هبوط أسفلتي وتطهير الموقع',
    woDescLabel: 'تعليمات التنفيذ (اختياري)',
    woDescPlaceholder: 'أدخل أي توجيهات محددة أو احتياطات للفرق الميدانية...',
    woDeptLabel: 'الجهة المختصة',
    woPriorityLabel: 'مستوى الأولوية',
    woDueDateLabel: 'موعد الإنجاز المستهدف (اختياري)',
    submitCreate: 'إنشاء أمر العمل',
    creationDisabledReason: 'إجراء الإنشاء غير متاح حاليًا بانتظار اكتمال واجهة برمجة أوامر العمل في الخادم.',
    cancel: 'إلغاء',
    close: 'إغلاق',
    unassigned: 'غير مسند',
    detailsTitle: 'تفاصيل أمر العمل',
    reportDetails: 'بيانات البلاغ المرتبط',
    citizenDescription: 'وصف المواطن',
    aiDescription: 'تحليل الذكاء الاصطناعي',
    location: 'إحداثيات الموقع',
    viewOnMap: 'عرض على خرائط Google',
    notAvailable: 'غير متاح',
    evidenceSection: 'أدلة إتمام الإصلاح',
    beforeImage: 'صورة البلاغ الأصلية',
    afterImage: 'صورة الإصلاح المعتمدة',
    noAfterImage: 'لم يتم رفع صورة الإصلاح بعد.',
    evidenceNote: 'ملاحظات الإنجاز',
    noEvidenceNote: 'لم يتم تدوين ملاحظات إنجاز بعد.',
    timelineSection: 'سجل الإجراءات والنشاط',
    noEvents: 'لا توجد إجراءات مسجلة بعد.',
    loadingReports: 'جاري تحميل البلاغات...',
    reportsLoadError: 'تعذر تحميل قائمة البلاغات للربط.',
    duplicateReportNotice: 'تنبيه منع التكرار: تفرض قاعدة البيانات والخادم وجود أمر عمل نشط واحد فقط لكل بلاغ. سيتم رفض أي محاولة تكرار برمز تعارض من الخادم (HTTP 409).',
    requireReport: 'يرجى اختيار بلاغ لربطه بأمر العمل.',
    requireTitle: 'يرجى إدخال عنوان واضح لأمر العمل.',
    statsUnavailable: 'بانتظار الربط',
    locationAvailable: 'الموقع متوفر',
    viewOriginal: 'عرض الصورة الأصلية',
    evidenceBadge: 'دليل معتمد',
    pendingBadge: 'بانتظار الرفع',
    authorizedImagePending: 'سيتم تحميل معاينة الصورة عبر روابط موثقة ومصرحة فور ربط واجهة أوامر العمل البرمجية.',
  },
}

const statusTranslations: Record<WorkStatus, { en: string; ar: string }> = {
  pending: { en: 'Pending', ar: 'قيد الانتظار' },
  assigned: { en: 'Assigned', ar: 'تم الإسناد' },
  in_progress: { en: 'In Progress', ar: 'قيد التنفيذ' },
  pending_verification: { en: 'Awaiting Review', ar: 'بانتظار التحقق' },
  completed: { en: 'Completed', ar: 'مكتمل' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
}

const priorityTranslations: Record<Priority, { en: string; ar: string }> = {
  Low: { en: 'Low', ar: 'منخفضة' },
  Medium: { en: 'Medium', ar: 'متوسطة' },
  High: { en: 'High', ar: 'مرتفعة' },
  Critical: { en: 'Critical', ar: 'حرجة' },
}

export default function WorkOrders({
  language,
  reports = [],
  reportsLoading = false,
  reportsError = '',
}: WorkOrdersProps) {
  const t = copy[language]
  const isArabic = language === 'ar'

  // Work Orders state - initialized empty (NO DEMO / NO MOCK DATA)
  const [orders] = useState<WorkOrder[]>([])

  // Filters & Search
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  // Selected Order for Details Drawer
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null)

  // Create Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [reportSearchQuery, setReportSearchQuery] = useState('')
  const [selectedReportId, setSelectedReportId] = useState<string>('')
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDepartment, setNewDepartment] = useState('')
  const [newPriority, setNewPriority] = useState<Priority>('Medium')
  const [newTargetCompletionAt, setNewTargetCompletionAt] = useState('')

  // Derive unique departments from existing reports for clean dynamic filtering
  const availableDepartments = useMemo(() => {
    const set = new Set<string>()
    reports.forEach((r) => {
      if (r.department && r.department.trim()) {
        set.add(r.department.trim())
      }
    })
    return Array.from(set).sort()
  }, [reports])

  // Selected report in create modal
  const selectedReportForCreate = useMemo(() => {
    return reports.find((r) => r.id === selectedReportId) ?? null
  }, [reports, selectedReportId])

  // Filtered reports inside create modal searchable dropdown
  const filteredReportsForPicker = useMemo(() => {
    const q = reportSearchQuery.trim().toLowerCase()
    if (!q) return reports
    return reports.filter((r) => {
      const code = (r.report_code ?? '').toLowerCase()
      const desc = (r.description ?? '').toLowerCase()
      const imgDesc = (r.image_description ?? '').toLowerCase()
      const cat = (r.category ?? '').toLowerCase()
      const dept = (r.department ?? '').toLowerCase()
      return (
        code.includes(q) ||
        desc.includes(q) ||
        imgDesc.includes(q) ||
        cat.includes(q) ||
        dept.includes(q)
      )
    })
  }, [reports, reportSearchQuery])

  // Filtered Work Orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const term = search.trim().toLowerCase()
      const matchesSearch =
        !term ||
        [order.reference, order.reportCode ?? '', order.title, order.department]
          .some((val) => val.toLowerCase().includes(term))

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || order.priority === priorityFilter
      const matchesDept = departmentFilter === 'all' || order.department === departmentFilter

      return matchesSearch && matchesStatus && matchesPriority && matchesDept
    })
  }, [orders, search, statusFilter, priorityFilter, departmentFilter])

  // Automatically update department when a report is picked in Create flow
  const handleSelectReport = (reportId: string) => {
    setSelectedReportId(reportId)
    const found = reports.find((r) => r.id === reportId)
    if (found?.department) {
      setNewDepartment(found.department)
    }
    if (found && !newTitle) {
      const categoryLabel = found.category
        ? translateCategory(found.category, language)
        : found.report_code
      setNewTitle(isArabic ? `أمر عمل: ${categoryLabel}` : `Work Order: ${categoryLabel}`)
    }
  }

  // Intentional reset of creation form when user cancels or closes modal
  const handleCloseCreateModal = () => {
    setCreateModalOpen(false)
    setReportSearchQuery('')
    setSelectedReportId('')
    setNewTitle('')
    setNewDescription('')
    setNewDepartment('')
    setNewPriority('Medium')
    setNewTargetCompletionAt('')
  }

  return (
    <div className="work-orders-page" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Page Header */}
      <header className="wo-page-header">
        <div className="wo-page-heading-copy">
          <div className="wo-title-wrapper">
            <ClipboardList className="wo-header-icon" size={26} aria-hidden="true" />
            <h1>{t.title}</h1>
          </div>
          <p className="wo-header-description">{t.subtitle}</p>
        </div>
        <div className="wo-header-actions">
          <button
            type="button"
            className="wo-btn-primary"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={17} aria-hidden="true" />
            <span>{t.create}</span>
          </button>
        </div>
      </header>

      {/* KPI Cards (Truthful Presentation: Distinguish Unavailable API from Real Zeros) */}
      <section className="wo-kpis-grid" aria-label={t.title}>
        <article className="wo-kpi-card">
          <div className="wo-kpi-card-header">
            <span>{t.total}</span>
            <span className="wo-kpi-icon-pill wo-icon-blue">
              <ClipboardList size={18} aria-hidden="true" />
            </span>
          </div>
          <div className="wo-kpi-number-wrap">
            {orders.length > 0 ? (
              <strong className="wo-kpi-value">{orders.length}</strong>
            ) : (
              <span className="wo-kpi-placeholder">—</span>
            )}
          </div>
          <small className="wo-kpi-subtext">{t.statsUnavailable}</small>
        </article>

        <article className="wo-kpi-card">
          <div className="wo-kpi-card-header">
            <span>{t.inProgress}</span>
            <span className="wo-kpi-icon-pill wo-icon-amber">
              <Wrench size={18} aria-hidden="true" />
            </span>
          </div>
          <div className="wo-kpi-number-wrap">
            {orders.length > 0 ? (
              <strong className="wo-kpi-value">
                {orders.filter((o) => o.status === 'in_progress').length}
              </strong>
            ) : (
              <span className="wo-kpi-placeholder">—</span>
            )}
          </div>
          <small className="wo-kpi-subtext">{t.statsUnavailable}</small>
        </article>

        <article className="wo-kpi-card">
          <div className="wo-kpi-card-header">
            <span>{t.pendingVerification}</span>
            <span className="wo-kpi-icon-pill wo-icon-violet">
              <ShieldCheck size={18} aria-hidden="true" />
            </span>
          </div>
          <div className="wo-kpi-number-wrap">
            {orders.length > 0 ? (
              <strong className="wo-kpi-value">
                {orders.filter((o) => o.status === 'pending_verification').length}
              </strong>
            ) : (
              <span className="wo-kpi-placeholder">—</span>
            )}
          </div>
          <small className="wo-kpi-subtext">{t.statsUnavailable}</small>
        </article>

        <article className="wo-kpi-card">
          <div className="wo-kpi-card-header">
            <span>{t.completed}</span>
            <span className="wo-kpi-icon-pill wo-icon-green">
              <CheckCircle2 size={18} aria-hidden="true" />
            </span>
          </div>
          <div className="wo-kpi-number-wrap">
            {orders.length > 0 ? (
              <strong className="wo-kpi-value">
                {orders.filter((o) => o.status === 'completed').length}
              </strong>
            ) : (
              <span className="wo-kpi-placeholder">—</span>
            )}
          </div>
          <small className="wo-kpi-subtext">{t.statsUnavailable}</small>
        </article>
      </section>

      {/* Toolbar & Filter Controls */}
      <section className="wo-toolbar-panel">
        <div className="wo-search-control">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
          />
          {search && (
            <button
              type="button"
              className="wo-clear-search-btn"
              onClick={() => setSearch('')}
              aria-label={t.resetFilters}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="wo-filters-group">
          {/* Status Filter */}
          <div className="wo-select-wrap">
            <Filter size={15} aria-hidden="true" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label={t.statusFilter}
            >
              <option value="all">{t.allStatuses}</option>
              <option value="pending">{statusTranslations.pending[language]}</option>
              <option value="assigned">{statusTranslations.assigned[language]}</option>
              <option value="in_progress">{statusTranslations.in_progress[language]}</option>
              <option value="pending_verification">
                {statusTranslations.pending_verification[language]}
              </option>
              <option value="completed">{statusTranslations.completed[language]}</option>
              <option value="cancelled">{statusTranslations.cancelled[language]}</option>
            </select>
            <ChevronDown size={14} className="wo-select-arrow" />
          </div>

          {/* Priority Filter */}
          <div className="wo-select-wrap">
            <AlertTriangle size={15} aria-hidden="true" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label={t.priorityFilter}
            >
              <option value="all">{t.allPriorities}</option>
              <option value="Low">{priorityTranslations.Low[language]}</option>
              <option value="Medium">{priorityTranslations.Medium[language]}</option>
              <option value="High">{priorityTranslations.High[language]}</option>
              <option value="Critical">{priorityTranslations.Critical[language]}</option>
            </select>
            <ChevronDown size={14} className="wo-select-arrow" />
          </div>

          {/* Department Filter */}
          <div className="wo-select-wrap">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label={t.departmentFilter}
            >
              <option value="all">{t.allDepartments}</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {translateDepartment(dept, language)}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="wo-select-arrow" />
          </div>

          {/* Reset Filters */}
          {(search || statusFilter !== 'all' || priorityFilter !== 'all' || departmentFilter !== 'all') && (
            <button
              type="button"
              className="wo-reset-filters-btn"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setPriorityFilter('all')
                setDepartmentFilter('all')
              }}
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>{t.resetFilters}</span>
            </button>
          )}
        </div>
      </section>

      {/* Main Table Container */}
      <div className="wo-table-wrapper">
        <table className="wo-table">
          <thead>
            <tr>
              <th>{t.reference}</th>
              <th>{t.relatedReport}</th>
              <th>{t.titleCol}</th>
              <th>{t.departmentCol}</th>
              <th>{t.assigneeCol}</th>
              <th>{t.priorityCol}</th>
              <th>{t.statusCol}</th>
              <th>{t.createdAtCol}</th>
              <th>{t.targetCompletionCol}</th>
              <th className="wo-actions-col-th">{t.actionsCol}</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const prio = order.priority
                const stat = order.status
                return (
                  <tr key={order.id} className="wo-table-row">
                    <td>
                      <button
                        type="button"
                        className="wo-reference-btn"
                        onClick={() => setSelectedOrder(order)}
                      >
                        {order.reference}
                      </button>
                    </td>
                    <td>
                      <span className="wo-report-code-badge">
                        {order.reportCode || order.report_id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="wo-title-cell">
                      <strong>{order.title}</strong>
                    </td>
                    <td>
                      <span className="wo-dept-badge">
                        {translateDepartment(order.department, language)}
                      </span>
                    </td>
                    <td>
                      <span className="wo-assignee-text">
                        <UserRound size={13} aria-hidden="true" />
                        {order.assignee || t.unassigned}
                      </span>
                    </td>
                    <td>
                      <span className={`wo-priority-badge wo-priority-${prio.toLowerCase()}`}>
                        {priorityTranslations[prio]?.[language] || prio}
                      </span>
                    </td>
                    <td>
                      <span className={`wo-status-badge wo-status-${stat}`}>
                        <span className="wo-status-dot" />
                        {statusTranslations[stat]?.[language] || stat}
                      </span>
                    </td>
                    <td className="wo-date-cell">
                      {new Date(order.created_at).toLocaleDateString(
                        isArabic ? 'ar-EG' : 'en-GB'
                      )}
                    </td>
                    <td className="wo-date-cell">
                      {order.target_completion_at
                        ? new Date(order.target_completion_at).toLocaleDateString(
                            isArabic ? 'ar-EG' : 'en-GB'
                          )
                        : '—'}
                    </td>
                    <td className="wo-actions-cell">
                      <button
                        type="button"
                        className="wo-action-icon-btn"
                        onClick={() => setSelectedOrder(order)}
                        title={t.viewDetails}
                        aria-label={t.viewDetails}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={10} className="wo-empty-cell">
                  <div className="wo-empty-state">
                    <div className="wo-empty-icon-wrap">
                      <ClipboardList size={36} strokeWidth={1.5} />
                    </div>
                    <h3>
                      {search || statusFilter !== 'all' || priorityFilter !== 'all' || departmentFilter !== 'all'
                        ? t.noMatchingTitle
                        : t.noOrdersTitle}
                    </h3>
                    <p>
                      {search || statusFilter !== 'all' || priorityFilter !== 'all' || departmentFilter !== 'all'
                        ? t.noMatchingDescription
                        : t.noOrdersDescription}
                    </p>
                    <div className="wo-empty-actions">
                      <button
                        type="button"
                        className="wo-btn-primary"
                        onClick={() => setCreateModalOpen(true)}
                      >
                        <Plus size={16} />
                        <span>{t.create}</span>
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Details Drawer / Modal */}
      {selectedOrder && (
        <div
          className="wo-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOrder(null)
          }}
        >
          <aside className="wo-details-drawer">
            <header className="wo-drawer-header">
              <div className="wo-drawer-title-group">
                <span className="wo-drawer-reference">{selectedOrder.reference}</span>
                <h2>{selectedOrder.title}</h2>
                <div className="wo-drawer-badges">
                  <span className={`wo-status-badge wo-status-${selectedOrder.status}`}>
                    <span className="wo-status-dot" />
                    {statusTranslations[selectedOrder.status]?.[language] || selectedOrder.status}
                  </span>
                  <span className={`wo-priority-badge wo-priority-${selectedOrder.priority.toLowerCase()}`}>
                    {priorityTranslations[selectedOrder.priority]?.[language] || selectedOrder.priority}
                  </span>
                  <span className="wo-dept-badge">
                    {translateDepartment(selectedOrder.department, language)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="wo-drawer-close-btn"
                onClick={() => setSelectedOrder(null)}
                aria-label={t.close}
              >
                <X size={20} />
              </button>
            </header>

            <div className="wo-drawer-scroll-body">
              {/* Linked Report Information */}
              <section className="wo-drawer-section">
                <h3>
                  <FileText size={17} aria-hidden="true" />
                  <span>{t.reportDetails}</span>
                </h3>
                {(() => {
                  const linkedReport = reports.find((r) => r.id === selectedOrder.report_id)
                  return (
                    <div className="wo-report-preview-box">
                      <div className="wo-report-preview-meta">
                        <div>
                          <label>{t.relatedReport}</label>
                          <strong>{selectedOrder.reportCode || linkedReport?.report_code || selectedOrder.report_id}</strong>
                        </div>
                        <div>
                          <label>{t.departmentCol}</label>
                          <strong>{translateDepartment(linkedReport?.department || selectedOrder.department, language)}</strong>
                        </div>
                        <div>
                          <label>{isArabic ? 'تاريخ البلاغ' : 'Report Date'}</label>
                          <strong>
                            {linkedReport?.created_at
                              ? new Date(linkedReport.created_at).toLocaleDateString(
                                  isArabic ? 'ar-EG' : 'en-GB'
                                )
                              : t.notAvailable}
                          </strong>
                        </div>
                        <div>
                          <label>{t.location}</label>
                          {linkedReport?.latitude != null && linkedReport?.longitude != null ? (
                            <a
                              href={`https://www.google.com/maps?q=${linkedReport.latitude},${linkedReport.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="wo-maps-link"
                            >
                              <MapPin size={13} />
                              <span>{t.viewOnMap}</span>
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span>{t.notAvailable}</span>
                          )}
                        </div>
                      </div>

                      {/* Citizen Description */}
                      <div className="wo-report-desc-field">
                        <label>{t.citizenDescription}</label>
                        <p>{linkedReport?.description?.trim() || t.notAvailable}</p>
                      </div>

                      {/* AI Description */}
                      {linkedReport?.image_description && (
                        <div className="wo-report-ai-card">
                          <label>{t.aiDescription}</label>
                          <p>{linkedReport.image_description}</p>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </section>

              {/* Work Order Description */}
              {selectedOrder.description && (
                <section className="wo-drawer-section">
                  <h3>
                    <Layers size={17} aria-hidden="true" />
                    <span>{t.titleCol}</span>
                  </h3>
                  <p className="wo-order-description-text">{selectedOrder.description}</p>
                </section>
              )}

              {/* Evidence Section (Before / After) */}
              <section className="wo-drawer-section">
                <h3>
                  <ImageIcon size={17} aria-hidden="true" />
                  <span>{t.evidenceSection}</span>
                </h3>
                <div className="wo-evidence-grid">
                  {/* Before / Original Image */}
                  <article className="wo-evidence-card">
                    <div className="wo-evidence-card-header">
                      <span>{t.beforeImage}</span>
                      <span className="wo-evidence-tag">{t.viewOriginal}</span>
                    </div>
                    <div className="wo-evidence-image-viewport">
                      <div className="wo-evidence-placeholder">
                        <ImageIcon size={26} />
                        <span className="wo-evidence-pending-text">{t.authorizedImagePending}</span>
                      </div>
                    </div>
                  </article>

                  {/* After / Repair Evidence */}
                  <article className="wo-evidence-card">
                    <div className="wo-evidence-card-header">
                      <span>{t.afterImage}</span>
                      <span
                        className={`wo-evidence-tag ${
                          selectedOrder.after_image_path ? 'wo-tag-verified' : 'wo-tag-pending'
                        }`}
                      >
                        {selectedOrder.after_image_path ? t.evidenceBadge : t.pendingBadge}
                      </span>
                    </div>
                    <div className="wo-evidence-image-viewport">
                      {selectedOrder.after_image_path ? (
                        <img
                          src={selectedOrder.after_image_path}
                          alt={t.afterImage}
                          className="wo-evidence-img"
                        />
                      ) : (
                        <div className="wo-evidence-placeholder">
                          <ImageIcon size={26} />
                          <span>{t.noAfterImage}</span>
                        </div>
                      )}
                    </div>
                  </article>
                </div>

                {/* Evidence Note */}
                <div className="wo-evidence-note-block">
                  <label>{t.evidenceNote}</label>
                  <p>{selectedOrder.evidence_note?.trim() || t.noEvidenceNote}</p>
                </div>
              </section>

              {/* Lifecycle & Event Timeline */}
              <section className="wo-drawer-section">
                <h3>
                  <Clock3 size={17} aria-hidden="true" />
                  <span>{t.timelineSection}</span>
                </h3>
                <div className="wo-timeline-list">
                  {selectedOrder.events && selectedOrder.events.length > 0 ? (
                    selectedOrder.events.map((ev, idx) => (
                      <div key={idx} className="wo-timeline-node">
                        <span className="wo-timeline-bullet" />
                        <div className="wo-timeline-content">
                          <strong>{ev.title}</strong>
                          <time>{ev.date}</time>
                          {ev.note && <p>{ev.note}</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="wo-subdued-text">{t.noEvents}</p>
                  )}
                </div>
              </section>
            </div>

            <footer className="wo-drawer-footer">
              <button
                type="button"
                className="wo-btn-secondary"
                onClick={() => setSelectedOrder(null)}
              >
                {t.close}
              </button>
            </footer>
          </aside>
        </div>
      )}

      {/* Create Work Order Modal */}
      {createModalOpen && (
        <div
          className="wo-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseCreateModal()
          }}
        >
          <div className="wo-create-dialog">
            <header className="wo-create-dialog-header">
              <div className="wo-create-dialog-title">
                <div className="wo-create-icon-badge">
                  <Plus size={20} />
                </div>
                <div>
                  <h2>{t.createTitle}</h2>
                  <p>{t.createSubtitle}</p>
                </div>
              </div>
              <button
                type="button"
                className="wo-dialog-close-btn"
                onClick={handleCloseCreateModal}
                aria-label={t.close}
              >
                <X size={19} />
              </button>
            </header>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="wo-create-form"
            >
              {/* Informational Banner: Backend Integration Pending */}
              <div className="wo-callout-info" role="status">
                <Info size={18} className="wo-callout-icon" />
                <div>
                  <strong>{t.apiNoticeTitle}</strong>
                  <p>{t.apiNoticeDesc}</p>
                </div>
              </div>

              {/* Duplicate Prevention Notice: Backend Authoritative */}
              <div className="wo-callout-warning">
                <AlertCircle size={18} className="wo-callout-icon" />
                <p>{t.duplicateReportNotice}</p>
              </div>

              {/* Step 1: Searchable Report Selector */}
              <fieldset className="wo-form-fieldset">
                <legend className="wo-form-legend">{t.selectReportSection}</legend>

                {reportsLoading && (
                  <p className="wo-loading-reports-note">
                    <RefreshCw size={14} className="wo-spin" /> {t.loadingReports}
                  </p>
                )}

                {reportsError && (
                  <p className="wo-error-reports-note">
                    <AlertTriangle size={14} /> {t.reportsLoadError}: {reportsError}
                  </p>
                )}

                <div className="wo-report-search-input-wrap">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="text"
                    value={reportSearchQuery}
                    onChange={(e) => setReportSearchQuery(e.target.value)}
                    placeholder={t.searchReportPlaceholder}
                    disabled={reportsLoading || Boolean(reportsError)}
                  />
                  {reportSearchQuery && (
                    <button
                      type="button"
                      className="wo-search-clear-mini"
                      onClick={() => setReportSearchQuery('')}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="wo-report-select-dropdown-wrap">
                  <select
                    value={selectedReportId}
                    onChange={(e) => handleSelectReport(e.target.value)}
                    disabled={reportsLoading || Boolean(reportsError) || reports.length === 0}
                    className="wo-report-picker-select"
                  >
                    <option value="">{t.selectReportPrompt}</option>
                    {filteredReportsForPicker.slice(0, 150).map((rep) => {
                      const code = rep.report_code || rep.id.slice(0, 8)
                      const cat = rep.category ? translateCategory(rep.category, language) : ''
                      const dept = rep.department ? ` · ${translateDepartment(rep.department, language)}` : ''
                      const desc = rep.description ? ` - ${rep.description.slice(0, 38)}...` : ''
                      return (
                        <option key={rep.id} value={rep.id}>
                          {code} [{cat}{dept}]{desc}
                        </option>
                      )
                    })}
                  </select>
                  <ChevronDown size={15} className="wo-picker-arrow" />
                </div>

                {/* Selected Report Preview Card */}
                {selectedReportForCreate && (
                  <div className="wo-selected-report-preview-card">
                    <div className="wo-preview-card-header">
                      <span className="wo-preview-code">{selectedReportForCreate.report_code}</span>
                      <span className="wo-preview-dept">
                        {translateDepartment(selectedReportForCreate.department, language)}
                      </span>
                    </div>

                    <div className="wo-preview-grid">
                      <div>
                        <label>{isArabic ? 'التصنيف' : 'Category'}</label>
                        <span>
                          {selectedReportForCreate.category
                            ? translateCategory(selectedReportForCreate.category, language)
                            : t.notAvailable}
                        </span>
                      </div>
                      <div>
                        <label>{isArabic ? 'الحالة الحالية' : 'Report Status'}</label>
                        <span>{selectedReportForCreate.status}</span>
                      </div>
                      <div>
                        <label>{isArabic ? 'تاريخ البلاغ' : 'Date'}</label>
                        <span>
                          {new Date(selectedReportForCreate.created_at).toLocaleDateString(
                            isArabic ? 'ar-EG' : 'en-GB'
                          )}
                        </span>
                      </div>
                      <div>
                        <label>{t.location}</label>
                        <span>
                          {selectedReportForCreate.latitude != null && selectedReportForCreate.longitude != null
                            ? t.locationAvailable
                            : t.notAvailable}
                        </span>
                      </div>
                    </div>

                    {selectedReportForCreate.description && (
                      <div className="wo-preview-desc">
                        <label>{t.citizenDescription}</label>
                        <p>{selectedReportForCreate.description}</p>
                      </div>
                    )}
                  </div>
                )}
              </fieldset>

              {/* Step 2: Work Order Fields */}
              <fieldset className="wo-form-fieldset">
                <legend className="wo-form-legend">{t.woDetailsSection}</legend>

                <div className="wo-form-field">
                  <label htmlFor="wo-title-input">
                    {t.woTitleLabel} <span className="wo-required-mark">*</span>
                  </label>
                  <input
                    id="wo-title-input"
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={t.woTitlePlaceholder}
                  />
                </div>

                <div className="wo-form-field">
                  <label htmlFor="wo-desc-input">{t.woDescLabel}</label>
                  <textarea
                    id="wo-desc-input"
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder={t.woDescPlaceholder}
                  />
                </div>

                <div className="wo-form-row">
                  <div className="wo-form-field">
                    <label htmlFor="wo-dept-select">
                      {t.woDeptLabel} <span className="wo-required-mark">*</span>
                    </label>
                    <select
                      id="wo-dept-select"
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                    >
                      <option value="">{isArabic ? '-- اختر الجهة --' : '-- Select Department --'}</option>
                      {availableDepartments.map((dept) => (
                        <option key={dept} value={dept}>
                          {translateDepartment(dept, language)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="wo-form-field">
                    <label htmlFor="wo-prio-select">
                      {t.woPriorityLabel} <span className="wo-required-mark">*</span>
                    </label>
                    <select
                      id="wo-prio-select"
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as Priority)}
                    >
                      <option value="Low">{priorityTranslations.Low[language]}</option>
                      <option value="Medium">{priorityTranslations.Medium[language]}</option>
                      <option value="High">{priorityTranslations.High[language]}</option>
                      <option value="Critical">{priorityTranslations.Critical[language]}</option>
                    </select>
                  </div>
                </div>

                <div className="wo-form-field">
                  <label htmlFor="wo-due-input">{t.woDueDateLabel}</label>
                  <input
                    id="wo-due-input"
                    type="date"
                    value={newTargetCompletionAt}
                    onChange={(e) => setNewTargetCompletionAt(e.target.value)}
                  />
                </div>
              </fieldset>

              <footer className="wo-create-actions">
                <button
                  type="button"
                  className="wo-btn-secondary"
                  onClick={handleCloseCreateModal}
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  className="wo-btn-primary wo-btn-disabled"
                  disabled={true}
                  title={t.creationDisabledReason}
                >
                  <Plus size={16} />
                  <span>{t.submitCreate}</span>
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
