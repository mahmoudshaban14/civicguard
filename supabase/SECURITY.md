# CivicGuard - Database Security (Supabase / PostgreSQL)

Owner: Role 2 (Database & Security). Last verified: 2026-10-23.
Everything below was checked against the real database (SQL queries and a real-login permission test), not assumed.

## 1. Architecture in one paragraph

Citizens use the mobile app and staff use the web dashboard. Both clients talk to Supabase with the **anon key only** (public by design) for login and for **reading** data. Every **write** (create report, change status, assign department) goes through our **backend API**, which uses the **service_role key on the server only**. Database permissions are enforced inside PostgreSQL, so hiding a button in the UI is never the protection.

## 2. Defense in layers

| Layer | What it does | Example |
|---|---|---|
| Table privileges (GRANT) | Decides who may touch a table at all | `authenticated` has only SELECT on reports; no INSERT/UPDATE/DELETE |
| Row Level Security (RLS) | Decides which rows each user sees | A citizen sees only rows where `user_id = auth.uid()` |
| Triggers | Protect fields and write history automatically | `user_id` and `report_code` cannot change; status changes are logged |
| CHECK constraints | Reject invalid values | status and severity lists, `image_path` must start with the owner's id |
| Backend API | Validates input, role and department before writing | Authority users only touch their own department |

RLS does not protect against TRUNCATE, so TRUNCATE, TRIGGER and REFERENCES are revoked from `anon` and `authenticated`.

## 3. Roles

| Role | Who | Can do |
|---|---|---|
| citizen | Mobile app user | Read own reports, history, notifications, images |
| authority | Staff of one department | Works through the API, scoped to the department in `profiles.department_id` |
| admin | Government admin | Reads everything; changes go through the API |

Admins are created manually from the Supabase dashboard, never from the app. A user cannot change their own `role` or `department_id` (column privileges plus a trigger).

## 4. Access by table (clients, using the anon key)

| Table | anon | Logged-in user |
|---|---|---|
| profiles | none | Read own; admin reads all; may update only `full_name` and `display_name` |
| reports | none | Read own; admin reads all; no direct writes |
| report_events | none | Read history of own reports; admin reads all; no direct writes |
| notifications | none | Read own; may update only `read` and `read_at` |
| ai_requests | none | Read own; admin reads all; written by the backend only |
| departments, categories | read (public lists) | read; writes only through the API |

Note: some policies (for example "admin update reports" and "admin insert events") still exist but are **inert**, because the matching GRANTs were removed. This is intentional defense in depth: if someone grants a privilege by mistake, RLS still limits the rows.

## 5. Storage

Bucket `report-images`: **private**, 5 MB limit, only jpeg/png/webp. Path must be `<user_id>/<filename>`.
Citizens upload and read only inside their own folder; admins read all. A CHECK constraint also forces `reports.image_path` to start with the owner's id.

## 6. Functions and triggers

- `is_admin()` is used by RLS and is the only SECURITY DEFINER function callable by signed-in users (it only answers "am I an admin?"). It is not callable by `anon`.
- All other SECURITY DEFINER functions (`handle_new_user`, `is_authority`, guard functions, status-history handler) have EXECUTE revoked from `anon`, `authenticated` and `public`. They still run as triggers.
- Triggers: a profile is created on sign-up; `report_code` (CG-YYYY-00001) is generated; guards on `reports` and `profiles` protect immutable fields and block non-privileged changes; every status change writes `report_events` and a notification; location is built from latitude/longitude.
- SECURITY DEFINER functions use `set search_path = ''` to prevent search-path hijacking.

## 7. Secrets

- Service role key and Gemini key live only in server environment variables / Edge Function secrets. They are not in the repo, the mobile app or the dashboard.
- Clients use only the project URL and the anon key.
- `.env` files are git-ignored. A scan of the repo and its history found no secrets (2026-10-22).

## 8. Tests

`supabase/tests/perm-test-phase3.mjs` logs in with real users using the anon key and runs 30 checks: row isolation between citizens, no direct writes (insert, update, delete) for citizens, admins and anon, role and department protection, function privileges, and storage isolation.
**Result on 2026-10-23: 30 passed, 0 failed.**

Run it (never against real data you care about; it needs two citizen test users and one admin test user):

```
cd supabase/tests
node perm-test-phase3.mjs
```

Environment variables (set in the terminal only, never committed): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CITIZEN_A_EMAIL/PASSWORD`, `CITIZEN_B_EMAIL/PASSWORD`, `ADMIN_EMAIL/PASSWORD`.
The older `perm-test.mjs` was written before direct writes were closed and is superseded.

## 9. Known limitations (honest list)

1. Authority department scoping is enforced in the **API code**, not by the database (the API uses service_role, which bypasses RLS). A mistake in the API could expose another department's reports.
2. Supabase "Leaked Password Protection" is disabled (a setting that may need a paid plan).
3. The Security Advisor last showed 0 errors and 2 warnings (`is_admin` executable by signed-in users, intentional, and the setting above). It must be re-run before the final demo.
4. `ai_requests` (rate limiting) exists but is not yet wired to the Gemini function.
5. A few team test reports have image paths that do not follow the `<user_id>/` convention; they were left untouched on purpose.
6. Test accounts with known passwords must be deleted before the demo.

## 10. أسئلة الحكام المتوقعة (Judge Q&A)

**1. ليه الـ anon key ممكن يكون في التطبيق لكن الـ service_role لأ؟**
الـ anon key مفتاح عام، أمانه في الـ RLS والـ GRANTs، وأي حد معاه مايقدرش يكتب ولا يقرأ غير اللي مسموح. أما service_role فبيتخطى الـ RLS تمامًا، فمكانه السيرفر بس.

**2. ازاي بتمنعوا مواطن يشوف تقرير مواطن تاني؟**
RLS على جدول reports: المواطن يقرأ بس الصفوف اللي `user_id` بتاعها هو. واختبرناها بتسجيل دخول فعلي (مواطن A مايشوفش تقرير B).

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

**9. إزاي اختبرتوا الأمان فعلًا؟**
سكريبت بيسجل دخول بمستخدمين حقيقيين ويحاول 30 هجمة (قراءة تقارير غيره، كتابة مباشرة، ترقية نفسه، رفع صورة في فولدر غيره)، والنتيجة 30 نجح و0 فشل.

**10. إيه اللي لسه ناقص؟**
فصل الأقسام للـ authority مبني في كود الـ API مش في الداتابيز، وLeaked Password Protection مقفول، وربط حدود طلبات الـ AI لسه مش مكتمل. وبنوضحهم بصراحة في قسم الـ limitations.
