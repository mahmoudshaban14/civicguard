# CivicGuard - Database Security (Supabase / PostgreSQL)

Owner: Role 2 (Database & Security). Last updated: 2026-10-27.
Everything marked "verified" was checked against the live database (SQL queries or a real-login permission test).

## 1. Architecture in one paragraph

Citizens use the mobile app and staff use the web dashboard. Both talk to Supabase with the **anon key only** (public by design) for login and for **reading** data. Every **write** (create report, change status, assign department) goes through our **backend API**, which uses the **service_role key on the server only**. Permissions are enforced inside PostgreSQL, so hiding a button in the UI is never the protection.

## 2. Defense in layers

| Layer | What it does | Example |
|---|---|---|
| Table privileges (GRANT) | Who may touch a table at all | `authenticated` has only SELECT on `reports` |
| Row Level Security (RLS) | Which rows each user sees | A citizen sees only rows where `user_id = auth.uid()` |
| Triggers | Protect fields and write history automatically | `user_id` and `report_code` cannot change; status changes are logged |
| CHECK / UNIQUE constraints | Reject invalid values | status and severity lists, `image_path` starts with the owner's id, unique national ID |
| Backend API | Validates input, role and department before writing | An authority user only touches reports of their department |

RLS does not protect against TRUNCATE, so TRUNCATE, TRIGGER and REFERENCES are revoked from `anon` and `authenticated`.

## 3. Roles

| Role | Who | Can do |
|---|---|---|
| citizen | Mobile app user | Reads own reports, history, notifications, images |
| authority | Staff of one department | Works through the API, scoped to `profiles.department_id` |
| admin | Government admin | Reads everything; changes go through the API |

Admins are created manually from the Supabase dashboard, never from the app. A user cannot change their own `role` or `department_id` (column privileges plus a trigger).

## 4. Tables and client access (anon key)

| Table | anon | Logged-in user |
|---|---|---|
| profiles | none | Reads own row; admin reads all; may update only `full_name` and `display_name` |
| reports | none | Reads own; admin reads all; no direct INSERT/DELETE; temporary exception below |
| report_events | none | Reads history of own reports; admin reads all; no writes |
| notifications | none | Reads own; may update only `read` and `read_at` |
| ai_requests | none | Reads own; admin reads all; written by the backend only |
| report_duplicate_candidates | none | **No access at all** (admin-only data, reached only through the API) |
| departments, categories | read (public lists) | read; writes only through the API |

Personal data: `profiles` holds `email`, `national_id` (14 digits) and `phone_number` (E.164). Only the owner and admins can read them. `profiles.email` is a copy of `auth.users.email`, kept in sync by a trigger, and is used by the backend to log in by national ID or phone number.

Some policies (for example "admin update reports") exist but are mostly **inert** because the matching GRANTs were removed. This is intentional defense in depth: if a privilege is granted by mistake, RLS still limits the rows.

## 5. Storage

Bucket `report-images`: **private**, 5 MB limit, only jpeg/png/webp. Path must be `<user_id>/<filename>`. Citizens upload and read only inside their own folder; admins read all. A CHECK constraint also forces `reports.image_path` to start with the owner's id.

## 6. Functions and triggers

- `is_admin()` is used by RLS and is the only SECURITY DEFINER function callable by signed-in users (it only answers "am I an admin?"). It is not callable by `anon`.
- All other SECURITY DEFINER functions (sign-up, guards, status history, email sync) have EXECUTE revoked from `anon`, `authenticated` and `public`; they still run as triggers. They use `set search_path = ''`.
- Sign-up trigger: creates the profile, normalizes the national ID and phone number, and **rejects invalid formats** (14-digit ID, Egyptian mobile in E.164); UNIQUE constraints reject duplicates.
- Guards on `reports` and `profiles` protect immutable fields and block non-privileged changes; the backend (service_role) and the SQL editor are trusted callers.
- Every status or department change writes `report_events` (who, old status, new status) and notifications.
- A separate trigger keeps `profiles.email` in sync with `auth.users`.

## 7. Secrets

- The service_role key and the Gemini key live only in server environment variables / Edge Function secrets. They are not in the repo, the mobile app or the dashboard.
- Clients use only the project URL and the anon key. `.env` files are git-ignored. A scan of the repo and its history found no secrets (2026-10-22).

## 8. Tests

`supabase/tests/perm-test-phase3.mjs` logs in with real users using the anon key and checks: row isolation between citizens, no direct writes (insert, update, delete) for citizens, admins and anon, role and department protection, function privileges, and storage isolation.
**Last reported result: 30 passed, 0 failed** (after the national-ID migration). It must be re-run before the demo (new tables were added since).

Run it from `supabase/tests` with `node perm-test-phase3.mjs`. It needs these environment variables set in the terminal only (never committed): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CITIZEN_A_EMAIL/PASSWORD`, `CITIZEN_B_EMAIL/PASSWORD`, `ADMIN_EMAIL/PASSWORD`. The test accounts must be deleted afterwards.

## 9. Known limitations (honest list)

1. Authority department scoping is enforced in the **API code**, not by the database (the API uses service_role, which bypasses RLS).
2. Supabase "Leaked Password Protection" is disabled (a setting that may need a paid plan).
3. There is no OTP proving that a person owns the national ID or phone number they sign up with, and sign-up is direct from the app, so someone could probe whether an ID is registered through the duplicate error.
4. `reports(action_status)` has a temporary column-level UPDATE for the dashboard (admins only, through RLS). It will be revoked once the API has a route for it.
5. `is_admin()` is callable by signed-in users (it only reveals their own status).
6. A few team test reports have `image_path` values without the `<user_id>/` prefix; they were left untouched on purpose and the CHECK applies to new rows.
7. The Security Advisor must be re-run before the demo (last known: 0 errors, 2 intentional warnings: `is_admin`, leaked passwords).

## 10. أسئلة الحكام المتوقعة (Judge Q&A)

**1. ليه الـ anon key ممكن يكون في التطبيق لكن الـ service_role لأ؟**
الـ anon key مفتاح عام، أمانه في الـ RLS والـ GRANTs، وأي حد معاه مايقدرش يكتب ولا يقرأ غير اللي مسموح. أما service_role فبيتخطى الـ RLS تمامًا، فمكانه السيرفر بس.

**2. ازاي بتمنعوا مواطن يشوف تقرير مواطن تاني؟**
RLS على جدول reports: المواطن يقرأ بس الصفوف اللي `user_id` بتاعها هو. واختبرناها بتسجيل دخول فعلي.

**3. ازاي بتمنعوا مواطن يخلي نفسه أدمن؟**
مفيش GRANT يسمحله يعدّل عمود role، وكمان trigger بيرفض. والأدمن بيتعمل يدويًا من لوحة Supabase.

**4. إيه الفرق بين GRANT و RLS؟**
GRANT بيحدد مين يقدر يعمل إيه على الجدول، وRLS بيحدد أنهي صفوف. الاتنين لازم، لأن RLS مابيحميش من TRUNCATE مثلًا.

**5. ليه الكتابة بتمر على الـ API مش من التطبيق مباشرة؟**
عشان لو الـ anon key اتسرّب مايقدرش حد يكتب أو يعدّل تقارير. الـ API بيتحقق من الدور والقسم قبل أي تعديل.

**6. إيه الخطر في إن الـ API بيستخدم service_role؟**
بيتخطى الـ RLS، فأمان الكتابة بيعتمد على كود الـ API. عشان كده الـ API بيتحقق من الـ JWT والدور، وكمان triggers بتحمي الحقول المهمة.

**7. ليه الـ bucket private؟**
الصور فيها مواقع وبلاغات ناس. الوصول بيتم بالـ policies مش بالرابط.

**8. ازاي بتعرفوا مين غيّر حالة التقرير؟**
trigger بيسجل كل تغيير في report_events (الحالة القديمة والجديدة ومين غيّرها ودوره)، والمواطن مايقدرش يكتب في الجدول ده.

**9. ازاي اختبرتوا الأمان فعلًا؟**
سكريبت بيسجل دخول بمستخدمين حقيقيين ويحاول 30 هجمة (قراءة تقارير غيره، كتابة مباشرة، ترقية نفسه، رفع صورة في فولدر غيره)، والنتيجة 30 نجح و0 فشل.

**10. ليه خزّنتوا الإيميل في profiles والرقم القومي؟ وإزاي بتحموه؟**
الدخول بالرقم القومي أو الموبايل بيتم في السيرفر: بيدوّر على الإيميل ويسجّل الدخول بيه. البيانات دي ما يقراهاش غير صاحبها والأدمن بالـ RLS، ومفيش دالة عامة بترجّع إيميل من رقم قومي (عشان محدش يعرف مين مسجّل).

**11. إيه جدول report_duplicate_candidates؟**
بيحفظ البلاغات المشتبه إنها مكررة (القريبة من بعض). بيانات للأدمن بس: مفيش أي صلاحية لأي عميل عليه، والـ backend هو اللي بيقرأ ويكتب فيه.

**12. إيه اللي لسه ناقص؟**
فصل الأقسام للـ authority مبني في كود الـ API مش في الداتابيز، وLeaked Password Protection مقفول، ومفيش OTP للتحقق من ملكية الرقم القومي. وبنوضحهم بصراحة في قسم الـ limitations.
