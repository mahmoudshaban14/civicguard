# CivicGuard Work Orders API

The Work Orders API (`/v1/work-orders`) manages the lifecycle of municipal maintenance and repair jobs linked to verified citizen reports.

---

## 1. Authentication & Role Model

All endpoints require a valid Supabase JWT Bearer token:
`Authorization: Bearer <access_token>`

The authenticated actor (`p_actor`) is derived exclusively from the verified token on the server. All database mutations execute via secure PostgreSQL RPCs restricted to `service_role`.

### Roles & Access Matrix

| Endpoint | Method | Admin | Dept Manager | Employee | Citizen |
|---|---|---|---|---|---|
| `/v1/work-orders` | `GET` | All | Own Dept | Assigned Only | 403 Forbidden |
| `/v1/work-orders/:id` | `GET` | All | Own Dept | Assigned Only | 403 Forbidden |
| `/v1/work-orders/:id/events` | `GET` | All | Own Dept | Assigned Only | 403 Forbidden |
| `/v1/work-orders` | `POST` | Allowed | Own Dept | 403 Forbidden | 403 Forbidden |
| `/v1/work-orders/:id/assign` | `POST` | Allowed | Own Dept | 403 Forbidden | 403 Forbidden |
| `/v1/work-orders/:id/start` | `POST` | 403 | 403 | Assigned Only | 403 Forbidden |
| `/v1/work-orders/:id/evidence/sign` | `POST` | Allowed | Own Dept | Assigned Only | 403 Forbidden |
| `/v1/work-orders/:id/submit` | `POST` | 403 | 403 | Assigned Only | 403 Forbidden |
| `/v1/work-orders/:id/review` | `POST` | Allowed (not own) | Own Dept (not own) | 403 Forbidden | 403 Forbidden |
| `/v1/work-orders/:id/cancel` | `POST` | Allowed | Own Dept | 403 Forbidden | 403 Forbidden |

---

## 2. Work Order Lifecycle State Machine

```
[ pending ] ──(assign)──> [ assigned ] ──(start)──> [ in_progress ]
                                                            │
                                                     (submit completion)
                                                            ▼
[ completed ] <──(approved)── [ pending_verification ]
      ▲                               │
      └──────(report: resolved)       └──(rejected)──> [ in_progress ] (report: in_progress)
```

- Any active work order in `pending`, `assigned`, or `in_progress` can be cancelled by an Admin or Department Manager with a mandatory cancellation reason (`cancellation_reason`).
- Rejection of a completion submission requires a mandatory `note` and returns the work order and associated report back to `in_progress`.
- Approval transitions the work order to `completed` and the report to `resolved` in a single atomic database transaction.
- Self-review is strictly blocked: an employee or manager cannot approve or reject work orders assigned to themselves.

---

## 3. Endpoints

### 3.1 List Work Orders
`GET /v1/work-orders`

**Query Parameters:**
- `status`: `'pending' | 'assigned' | 'in_progress' | 'pending_verification' | 'completed' | 'cancelled'`
- `priority`: `'Low' | 'Medium' | 'High' | 'Critical'`
- `department_id`: UUID (Admin only)
- `assigned_to`: UUID
- `limit`: Integer (default 50, max 100)
- `offset`: Integer (default 0)

---

### 3.2 Get Work Order Detail
`GET /v1/work-orders/:id`

Returns work order metadata along with attached completion evidence and temporary 1-hour signed URLs for photos in the private `work-order-evidence` storage bucket.

---

### 3.3 Create Work Order
`POST /v1/work-orders`

**Body:**
```json
{
  "report_id": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  "department_id": "10000000-0000-4000-8000-000000000001",
  "title": "Repair damaged road curb",
  "description": "Concrete cracked near intersection",
  "priority": "High",
  "target_completion_at": "2026-11-05T12:00:00Z",
  "assigned_to": "30000000-0000-4000-8000-000000000001"
}
```

---

### 3.4 Assign Work Order
`POST /v1/work-orders/:id/assign`

**Body:**
```json
{
  "assigned_to": "30000000-0000-4000-8000-000000000001",
  "note": "Assigned to road maintenance crew lead"
}
```

---

### 3.5 Start Work Order
`POST /v1/work-orders/:id/start`

Marks the work order as `in_progress`. Can only be invoked by the assigned employee.

---

### 3.6 Sign Evidence Upload URL
`POST /v1/work-orders/:id/evidence/sign`

Generates a signed upload URL for the private `work-order-evidence` bucket. Storage path is automatically formatted as `<work_order_id>/<timestamp>-<uuid>.<ext>`.

**Body:**
```json
{
  "file_name": "curb_repaired.jpg"
}
```

---

### 3.7 Submit Completion Evidence
`POST /v1/work-orders/:id/submit`

Submits between 1 and 5 after photos. Transitions the work order to `pending_verification` and the report to `under_review`.

**Body:**
```json
{
  "after_paths": [
    "11111111-2222-4333-8444-555555555555/photo-1.jpg"
  ],
  "notes": "Completed curb recasting and asphalt patching"
}
```

---

### 3.8 Review Work Order
`POST /v1/work-orders/:id/review`

**Body:**
```json
{
  "decision": "approved",
  "note": "Work inspected and approved"
}
```
*(If decision is `"rejected"`, `"note"` is required).*

---

### 3.9 Cancel Work Order
`POST /v1/work-orders/:id/cancel`

**Body:**
```json
{
  "reason": "Utility contractor handled repairs directly"
}
```

---

### 3.10 View Audit History Events
`GET /v1/work-orders/:id/events`

Returns immutable audit records from `work_order_updates` for the work order.

