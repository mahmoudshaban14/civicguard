# CivicGuard Backend Design

Status: **final** · Created 2026-10-19 · Finalized 2026-10-21 against repo commit `34b6ed6`

## 0. Decisions

| Decision | Choice |
|---|---|
| Backend language | Node.js 22 + TypeScript |
| HTTP framework | **Express 5** |
| Data path | **API-first.** The mobile app and the admin dashboard read and write reports only through the Node API. They talk to Supabase directly only for login (Supabase Auth). |
| Database / auth / files | Existing Supabase project (Postgres, Auth, Storage) |
| AI | Gemini Vision first, behind an `AiProvider` interface so a local model (for example Ollama) can be added later without other changes |
| Order of work | Fix database → API → connect app and dashboard so everything works end to end → AI → hardening and push notifications |

## 1. Where the project stands today

Read from the repo (`mahmoudshaban14/civicguard`, 14 commits, latest `34b6ed6`):

| Area | State |
|---|---|
| Mobile client | Expo / React Native (TypeScript, Expo Router, HeroUI Native), runs on iOS, Android and web (PWA). Login, sign-up and logout screens now call Supabase Auth (Arabic UI strings). |
| Admin dashboard | **New:** `admin-dashboard/`, a separate Vite + React web app. Signs in with Supabase Auth, checks `profiles.role = 'admin'` in the browser, then reads `reports` directly with the anon key. Shows total / under review / in progress / resolved counts and a filterable table. Read-only: no status changes yet. |
| App data | All in memory. `lib/civicguard-store.tsx` holds reports, notifications and drafts in React state. `lib/civicguard-data.ts` has three hard-coded reports. Nothing is persisted. |
| "AI" | `lib/civicguard-ai.ts` is a deterministic keyword and filename classifier. It never looks at pixels. 29 categories live in `lib/civicguard-categories.ts` (each with department, default severity, confidence range). |
| Authority / Security / CCTV screens | Simulations. The security monitor says "No backend rate limiter is connected". |
| Database | Three Supabase-style migrations exist: `profiles` (role citizen/admin, signup trigger), `reports` + `report_events` (RLS, `is_admin()`, code `CG-YYYY-00001`), and a private `report-images` bucket with per-user folder policies. |
| Client wiring | `lib/supabase.ts` is now a real `@supabase/supabase-js` client configured from `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The old `lib/bilt.ts` is unused and `lib/database.types.ts` is still empty. Report screens still use the in-memory mock store, so no report reaches the database yet. |
| Grants | Two new migrations: `authenticated` gets select/insert/update on `reports` and select/insert on `report_events` (RLS still filters rows), and TRUNCATE / TRIGGER / REFERENCES are revoked from `anon`, `authenticated` and `PUBLIC`. |

So there is still no application backend, but there is now a working auth flow, a real Supabase project, and an admin web dashboard. The design below builds on all three instead of replacing them.

## 2. Approach: a Node.js API on top of Supabase

Node.js with TypeScript is the right choice. The client is already TypeScript and already uses Zod, so types and validation schemas can be shared, and the team already knows the language.

One refinement. Don't make Node the whole backend. Split responsibilities:

- **Postgres + Supabase Auth + Storage + Realtime (already in use):** identity, tables, row-level security (RLS), file storage, live status updates.
- **Node.js API (new):** everything that must not run on the phone or be trusted from it: AI analysis (secret keys, cost), duplicate detection, routing and status workflow, notifications, rate limiting, audit logging.

Why not a full custom Express + raw Postgres backend (the original proposal)? It means rebuilding auth, password reset, token refresh and signed image URLs, and discarding the three migrations already written. Why not Supabase alone with no Node? The AI key can't live in the app, and the workflow rules and security story (rate limiting, audit trail) need server code. This project is also headed toward a SOC-flavoured demo, so owning that layer is a feature.

### Stack

| Concern | Choice | Reason |
|---|---|---|
| Runtime | Node 22 LTS, TypeScript | Matches client (`engines >=20.19.4`). |
| HTTP framework | **Express 5** with `helmet`, `cors`, `express-rate-limit`, `multer` (uploads), `pino-http` (logs) | Most familiar to the team, large ecosystem. Express 5 handles errors thrown in async handlers, so no wrapper is needed. |
| Validation | Zod (already in the client), with a small `validate(schema)` middleware for body, query and params | One schema gives the request type and the runtime check. Add `zod-to-openapi` later if the team wants API docs. |
| DB access | `kysely` over `pg`, plus SQL migrations in `supabase/migrations` | Type-safe queries. Keep migrations as plain SQL. |
| Auth | Verify the Supabase access token in an Express middleware, either with `jose` against the project's JWKS or with `supabase.auth.getUser(token)` | No second login system. |
| Supabase access | `@supabase/supabase-js` for Storage and Auth admin calls, `pg` or `kysely` for SQL | |
| AI | Gemini Vision (original proposal) behind an `AiProvider` interface, with the existing keyword classifier kept as the `mock` provider | Tests and demos work offline. |
| Jobs | `pg-boss` (queue in Postgres) | No Redis to run. |
| Push | `expo-server-sdk` | Client is Expo. |
| Geo | PostGIS | Radius search for the map and duplicate detection. |
| Tests | Vitest + Testcontainers (Postgres) | |
| Deploy | Docker image on Render / Railway / Fly.io, DB on Supabase | |

## 3. Architecture

```
 Expo app (citizen)        admin-dashboard (Vite web)
        │  HTTPS + Supabase JWT      │
        ▼                            ▼
 ┌──────────────────────────────────────────┐
 │ Node.js API (Express)                    │
 │  auth → rate limit → validate → handler  │
 │  routes: reports, analysis, authority,   │
 │          notifications, security         │
 └───────┬──────────────┬───────────────────┘
         │              │ enqueue
         │ SQL (user-scoped, RLS on)   ▼
         ▼                       pg-boss worker
 Supabase Postgres + PostGIS      ├─ Gemini Vision call
 Auth · Storage · Realtime        ├─ duplicate check
                                  └─ Expo push sender
```

Because the API is the only way in, it works like this:

1. The API verifies the caller's token, finds the user id and role, and checks ownership or role in code on every route.
2. The API connects with the server-side database credentials. Row-level security stays enabled as a second layer, and the client-facing write grants (insert and update on `reports`, insert on `report_events`) are revoked once the apps use the API (phase 3), so a leaked publishable key cannot write anything.
3. The service key and database password live only in the API's environment variables, never in `EXPO_PUBLIC_*` or any file in git.

## 4. Gaps in the existing schema and client (fix first)

These are real issues found while reading the migrations and the new auth code:

1. **Citizens can forge workflow fields.** The insert policy only checks `user_id = auth.uid()`. A citizen can insert a report with `status = 'resolved'`, any `severity` or `department`. Fix: citizen inserts go through the API, and a trigger or column privilege forces `status = 'submitted'` and nulls AI fields on citizen inserts. Only the service role writes AI fields.
2. **UI and DB vocabularies don't match.** UI statuses are 4 (`Reported / Assigned / In Progress / Resolved`), DB has 11. UI severity includes `Requires Review`, the DB check doesn't. UI confidence is 0–100, DB is 0–1. Define one canonical set in the DB and map once in the API serializer.
3. **No `updated_at` trigger,** and `report_events` rows are only inserted by admins. Status changes must write an event automatically (trigger), otherwise the timeline can lie.
4. **Roles too coarse.** Only `citizen` and `admin`. The Authority View needs department staff who see only their department's reports.
5. **Missing tables:** departments, categories (currently hard-coded in the client), notifications, push tokens, report images (one report can have several), security/audit events.
6. **Location is two floats and no area name.** The UI shows "area" and "distance". Add a PostGIS `geography(Point)` column with a GiST index.
7. **Year-bound code uses one global sequence.** `CG-2027-00128` will follow `CG-2026-00127`. Fine for a prototype, but decide whether numbering resets per year.
8. `civicguard-ai.ts` says `possibleDuplicate: 'No matching active report found'` as a constant. There is no real duplicate detection yet.
9. **Sign-up writes to `profiles` from the client and fails silently.** `app/auth/sign-up.tsx` inserts `{ id, full_name, role: 'citizen' }` into `profiles`. That can't work: the table has no `full_name` column, `authenticated` has no insert grant or policy on it, and the signup trigger already created the row. The error is only `console.log`ged, so the user's name is never saved (it survives only in auth metadata). Remove the client insert. Add `profiles.full_name` and have `handle_new_user()` copy it from `raw_user_meta_data`. Do **not** "fix" this by granting insert on `profiles`: a client-supplied `role` would let anyone make themselves an admin.
10. **The admin check in the dashboard is only a UI gate.** `admin-dashboard/src/App.tsx` signs the user out when the profile isn't admin, but the real enforcement is the RLS policies, which is correct. Keep it that way. Note the blanket `grant update on reports` means an admin session can change any column (including `user_id`, `report_code`); restrict with column-level grants or move admin writes to the API.
11. **Admin writes bypass the audit trail.** The `update` grant lets an admin change `reports.status` straight from the browser, with no `report_events` row, no notification and no transition check. When the dashboard gets status buttons, route them through the API (section 6).
12. `config.toml` is unchanged: minimum password length 6, email confirmation off. The sign-up screen also trusts the client for validation.

## 5. Data model (target)

```
auth.users 1─1 profiles(id, role[citizen|authority|admin], department_id?, display_name, created_at)
departments(id, name, slug)
categories(id text pk, label, department_id, default_severity, min_conf, max_conf, active)   -- seeded from civicguard-categories.ts
reports(id, report_code, user_id, category_id, status, severity, confidence numeric(4,3),
        description, area_name, location geography(Point,4326), explanation, secondary_issues text[],
        requires_manual_review, duplicate_of uuid?, assigned_department_id, assigned_to uuid?,
        created_at, updated_at, resolved_at)
report_images(id, report_id, storage_path, width, height, sha256, created_at)
report_events(id, report_id, actor_id, actor_role, old_status, new_status, note, created_at)  -- written by trigger
notifications(id, user_id, report_id, type, title, body, read_at, created_at)
push_tokens(id, user_id, token unique, platform, created_at)
security_events(id, at, actor_id?, ip_hash, route, kind, detail jsonb)                        -- feeds the Security Monitor screen
```

Seed `categories` and `departments` from the existing 29-entry config so the client and server stop drifting. The server is authoritative for department and default severity. The model only proposes a category.

### Status workflow (server-enforced)

```
submitted → ai_analyzed → assigned → under_review → in_progress → resolved
                 │             │
                 ├→ manual_review_required → assigned
                 └→ duplicate | invalid | rejected | escalated (authority/admin only)
```

A transition table in code (and a DB check trigger) rejects illegal jumps, for example `submitted → resolved`.

UI mapping: `submitted, ai_analyzed → Reported`, `assigned, under_review → Assigned`, `in_progress, escalated → In Progress`, `resolved → Resolved`. Rejected, duplicate and invalid get their own badges.

## 6. API surface (v1, REST, JSON)

All routes need `Authorization: Bearer <supabase jwt>` except `/health`.

**Citizen**

| Method + path | Purpose |
|---|---|
| `POST /v1/uploads/sign` | Returns a signed upload URL for `report-images/{uid}/{uuid}.jpg` after checking type and size. |
| `POST /v1/reports/analyze` | Body: `{ imagePath, description?, location }`. Runs AI (sync, 10 s timeout, rate-limited) and returns the suggestion (category, confidence, severity, department, explanation, possible duplicate). Nothing is saved yet. This matches today's analyzing → result screens. |
| `POST /v1/reports` | Create from an analysis id plus the user's edits. Server recomputes department, severity and status. Idempotency-Key header supported. |
| `GET /v1/reports?mine=1` / `GET /v1/reports/:id` | List and detail, including timeline events and a short-lived signed image URL. |
| `GET /v1/reports/nearby?lat&lng&radius` | Map tab. Public fields only (no user id, no exact reporter info). |
| `GET /v1/notifications`, `POST /v1/notifications/read` | Notification screen. |
| `POST /v1/push-tokens` | Register an Expo push token. |
| `DELETE /v1/me` | Account and data deletion (privacy screen). |

**Authority / admin**

| Method + path | Purpose |
|---|---|
| `GET /v1/authority/reports?status&severity&department` | Triage queue. Authority users are automatically limited to their department. |
| `PATCH /v1/authority/reports/:id/status` | Body: `{ status, note }`. Validates the transition, writes the event, creates a notification. |
| `POST /v1/authority/reports/:id/assign` | Reassign department (manual-review reports). |
| `GET /v1/admin/security/events`, `/v1/admin/stats` | Real data behind the Security Monitor and dashboard. |

Errors use one shape: `{ error: { code, message, requestId } }`. Keep one `docs/api.md` (or an OpenAPI file) up to date so the app and dashboard developers know the contract.

## 7. AI analysis pipeline

1. The client uploads the image straight to Storage (private bucket, 5 MB cap, jpeg/png/webp already enforced).
2. `POST /v1/reports/analyze` downloads the object server-side. The server re-validates magic bytes, **strips EXIF** (GPS metadata would leak the reporter's position), and resizes to about 1024 px.
3. Gemini Vision is called with a constrained JSON schema: `category_id` must be one of the seeded ids, plus `confidence`, `secondary_ids[]`, `explanation`. Temperature 0.
4. The server applies the existing rules deterministically: confidence below 0.70 or `other` sets `requires_manual_review`; department and severity come from the `categories` table, never from the model.
5. Duplicate check: PostGIS `ST_DWithin(location, point, 50)` with same category and an open status in the last 14 days. Return the candidate's code so the UI can say "similar report nearby".
6. Failure handling: provider timeout or error falls back to `manual_review_required`, so a report can always be submitted.
7. Persist each analysis (raw response, model name, latency) for auditing and later tuning. Keep it separate from the report row.

Prompt-injection note: the citizen description is untrusted text that reaches the model. Pass it as quoted data, not instructions, and never let model output choose a department, status or any field outside the schema.

## 8. Security design

This part supports the SOC angle of the project.

- **Authentication:** verify the JWT signature (JWKS), `exp`, `aud`. Reject on any failure. Disable anonymous sign-ins (already off in `config.toml`). Raise `minimum_password_length` from 6 to at least 10, and enable email confirmations (currently `false`).
- **Authorization:** three layers. API role checks, RLS in Postgres (defense in depth), and department scoping for authority users. Add RLS update and delete policies deliberately. Today there are none for citizens, which is correct, but write tests proving it.
- **Rate limiting:** `express-rate-limit`, per user and per IP, with a much tighter bucket on `/reports/analyze` (it costs money). Return 429 with `Retry-After`. Every limit hit writes a `security_events` row, which makes the Security Monitor screen real instead of simulated.
- **Input handling:** Zod on every route, body size limits, strict CORS allowlist, Helmet headers, parameterized queries only.
- **Uploads:** content sniffing, EXIF removal, random object names, signed URLs that expire in minutes, optional perceptual hash to catch repeated spam images.
- **Privacy:** reporter identity is never returned on the public/nearby endpoint. Hash IPs in logs. Support account deletion (cascade already exists on `user_id`).
- **Abuse:** per-user daily report cap, trust score later (repeated `invalid` reports reduce limits).
- **Secrets:** server-only env vars (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`), validated at boot with Zod. Never commit `.env`.
- **Audit:** every status change and admin action is an event with actor and timestamp.

## 9. Repository layout

The root is the Expo app and `admin-dashboard/` already sits beside it, so keep the backend self-contained as a third sibling:

```
admin-dashboard/         (exists)
backend/
  package.json  tsconfig.json  Dockerfile  .env.example
  src/
    server.ts            starts the HTTP server
    app.ts               builds the Express app (middleware, routes), easy to test
    config.ts            env validation with Zod
    middleware/          auth.ts  require-role.ts  rate-limit.ts  validate.ts  error-handler.ts
    modules/
      reports/           routes.ts  service.ts  schema.ts
      analysis/          routes.ts  provider.gemini.ts  provider.mock.ts  rules.ts
      authority/  notifications/  security/  uploads/
    db/                  client.ts  queries/
    jobs/                worker.ts  analyze.ts  push.ts
  test/
supabase/migrations/     (existing + new)
docs/backend-design.md
```

The `provider.mock.ts` can be a port of today's `civicguard-ai.ts`, so existing demo scenarios keep working.

## 10. Roadmap

Priorities: Node.js, everything connected and working, then AI.

| Phase | Deliverable | Done when |
|---|---|---|
| 0. Database fix | Migration for sections 4 and 5: roles, categories and departments (seeded), PostGIS, history trigger, forged-field fix, `profiles.full_name` + trigger fix, notifications. Regenerate `database.types.ts`. Remove the client-side profile insert in `sign-up.tsx`. Add `.env` to `.gitignore`. | A citizen cannot set `status` or `role` and cannot read others' reports; a new sign-up stores the name |
| 1. API skeleton | Express + TypeScript project in `backend/`, env validation, token verification, role middleware, error shape, basic rate limiting, `/health`, Dockerfile, CI (lint, test) | `GET /v1/reports?mine=1` returns the caller's reports with a real token and `401` without one |
| 2. Reports and uploads | Signed upload URL, create, list mine, detail with timeline, nearby (see section 6). Category and department come from the database tables. | A report created through the API appears in the database with the right status, department and history entry |
| 3. Connect everything | **App:** replace `civicguard-store.tsx` mock state with API calls (React Query); notifications screen reads the API. **Dashboard:** switch reads to the API, add status and assign actions through the API, show history. **Then revoke** the client write grants and delete `lib/bilt.ts` and the `@biltme/backend` dependency. | Submit a report on the phone, see it in the dashboard, change its status there, see the new status and a notification on the phone. No sample data remains. |
| 4. AI analysis | `AiProvider` interface, mock provider (port of the current classifier), Gemini provider, rules, duplicate check, fallback to manual review, saved analysis records | The analyze screen shows a real Gemini result; with the key removed it falls back to the mock; low confidence goes to manual review |
| 5. Security and audit | `security_events`, per-user and per-IP limits with `429` logging, admin endpoints for the Security Monitor screen, password policy and email confirmation in Supabase config | The Security Monitor screen shows real events instead of the simulation |
| 6. Push and deploy | Expo push tokens and sender, deploy API (Render / Railway / Fly.io), production env vars, smoke test | Status change sends a push to a real phone; the app works against the deployed API |

Phases 0–3 are the critical path and are what "everything connected and working" means. Phases 4 and 5 can be split between two people once phase 3 lands.

## 11. Open questions and decisions

Resolved by the latest commits:

- **Where does the database live?** Now an own Supabase project (`EXPO_PUBLIC_SUPABASE_URL`), so the service-role key and direct SQL access are available. Still confirm that the project's keys are held by the team lead and that `.env` files stay out of git (only `.env*.local` is ignored today; add `.env` to `.gitignore`).
- **Authority users:** the admin side is a separate web dashboard, so CORS, an allowlisted origin and a web login flow are in scope. The new `authority` role should log in there too.
- **Language:** the mobile auth screens are Arabic, so store Arabic and English labels for categories and notification text from the start (a `category_translations` table or a `labels jsonb` column).

Still open:

1. **Real CCTV integration:** keep it as a simulation, or is there a camera data source? I'd keep it simulated and out of scope for v1.
2. **Gemini quota and cost:** free tier limits decide how strict the analyze rate limit must be for demo day.
3. **Hosting for the Node API:** which of Render / Railway / Fly.io the team can use for free during the demo period. Needed by phase 6, not before.
4. **Dashboard scope:** is the dashboard admin-only for v1, or do department staff (the `authority` role) also use it?
