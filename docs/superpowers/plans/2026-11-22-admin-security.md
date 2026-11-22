# Admin Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only allowlisted admin accounts can change Cuong's data or images; the `/admin` login becomes a real Supabase Auth login.

**Architecture:** Supabase Auth (email + password) on the admin page; Postgres RLS on `cuong_trading.*` and `storage.objects` gated on `cuong_trading.is_admin()` (an allowlist table). Rolled out additive-first, then the page, then the lockdown, so the admin never loses the ability to save.

**Tech Stack:** Static HTML/JS on nginx (push to `main` auto-deploys), supabase-js v2 from CDN, self-hosted Supabase at `https://api.hsweb.pics` (SQL applied through pg-meta `/pg/query` with the service key), Node 20 for checks.

**Spec:** `docs/superpowers/specs/2026-11-22-admin-security-design.md`

## Global Constraints

- The repo is public and nginx serves every file not in `.dockerignore`: no keys, passwords or the admin email in committed files.
- Add `docs` and `supabase` to `.dockerignore`. Commit docs and SQL only after the lockdown is live.
- Schema `cuong_trading`, bucket `cuong-trading`, tables `events`, `exchanges`, `reviews`, `site_texts`.
- Kept as-is: table policies `public_read`, storage policy `cuong_public_read`.
- Dropped in the lockdown: table policies `public_write`; storage policies `cuong_public_write`, `cuong_public_update`, `cuong_public_delete`.
- New policy names: tables `admin_insert`, `admin_update`, `admin_delete`; storage `cuong_admin_insert`, `cuong_admin_update`, `cuong_admin_delete`; all `to authenticated`, gated on `(select cuong_trading.is_admin())`.
- Admin UI copy in Korean; minimum new password length 8; session kept in `sessionStorage`.
- `script.js` and `style.css` are unchanged, so there is no `?v=` bump. `admin/index.html` already has no-cache meta tags.

## Review Focus

- Anyone can sign up on this shared instance → a non-admin account must be rejected by the page ("관리자 권한이 없는 계정입니다") and by the server (verify check `non-admin *`).
- Wrong password or stray spaces in the email → clear Korean error, password cleared, no stuck button (browser smoke `wrong password`).
- Reload while logged in → dashboard comes back without logging in again; logout → gate (browser smoke `reload keeps session`, `logout`).
- Image uploads must carry the login session once the second client is removed (browser smoke `page storage upload/remove`, verify `admin upload`).
- Visitors see exactly what they saw before: anon reads keep returning 15/3/1/52 rows and review images still load (verify `anon read`, `public image`).

---

### Task 1: Server allowlist, admin account and the security check

**Files:**
- Create: `supabase/verify-security.mjs`
- Create: `supabase/01-admin-auth.sql`

**Interfaces:**
- Produces: table `cuong_trading.admins(user_id uuid primary key references auth.users on delete cascade, created_at timestamptz)`; function `cuong_trading.is_admin() returns boolean` (callable as `sb.rpc('is_admin')` by `authenticated`); the admin account's credentials in `$SCRATCH/out/admin.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, never committed).
- Produces: `node supabase/verify-security.mjs` with env `SUPABASE_SERVICE_ROLE_KEY` (required), `ADMIN_EMAIL` and `ADMIN_PASSWORD` (optional; admin checks SKIP without them). It reads the URL and anon key from `script.js`, prints `PASS|FAIL|SKIP <check> — <detail>`, and exits 1 on any FAIL. Probe rows use keys `zz_probe_*`, probe files go under `zz-probe/`, and a `finally` sweep removes both (plus the throwaway user) with the service key.

- [ ] **Step 1: Write the check script.** Checks:
  - `anon read`: four tables return 200.
  - `anon insert blocked`: POST `site_texts` → 401/403.
  - `anon update blocked`: PATCH `events?id=eq.00000000-0000-0000-0000-000000000000` → 401/403.
  - `anon delete blocked`: DELETE on the same filter → 401/403.
  - `anon upload blocked`: upload to `zz-probe/` → 4xx and the object does not exist.
  - `non-admin *` (throwaway user created and deleted through the GoTrue admin API): `is_admin` is `false`; insert → 401/403; PATCH and DELETE of a service-created `zz_probe_row` return `[]` and the row is unchanged; upload → 4xx.
  - `admin *`: `is_admin` is `true`; insert/update/delete of `zz_probe_admin` each affect one row; upload and remove of a `zz-probe/` file succeed.
  - `public image`: one review `image_url` returns 200.
- [ ] **Step 2: Run it before any change (red).** Expected: the anon and non-admin write checks FAIL (writes are open), `admin *` SKIP, reads PASS, and the sweep leaves no `zz_probe` rows or files.
- [ ] **Step 3: Write `supabase/01-admin-auth.sql`** (idempotent). Create `admins` (RLS on, `revoke all from public, anon, authenticated`). Create `is_admin()` as `language sql stable security definer set search_path = ''`, returning `exists(select 1 from cuong_trading.admins where user_id = auth.uid())`; revoke from `public, anon`; grant execute to `authenticated, service_role`. Add the six admin policies from Global Constraints. End with `notify pgrst, 'reload schema'`.
- [ ] **Step 4: Apply it via pg-meta, then inspect.** Expected: both policy sets exist; `has_table_privilege('anon'|'authenticated', 'cuong_trading.admins', 'SELECT')` is false; `has_function_privilege('anon', 'cuong_trading.is_admin()', 'EXECUTE')` is false.
- [ ] **Step 5: Create the admin account.** Use `POST /auth/v1/admin/users` with `email_confirm: true` and a random 16-character password from an unambiguous alphabet. Insert its id into `cuong_trading.admins`. Save the credentials to `$SCRATCH/out/admin.env` with mode 600.
- [ ] **Step 6: Re-run the checks.** Expected: `admin *` and `non-admin is_admin=false` PASS. The anon and non-admin write checks still FAIL (lockdown not applied yet).

### Task 2: Admin page login on Supabase Auth

**Files:**
- Modify: `admin/index.html` (gate markup ~509-518, gate CSS ~112, settings cards ~899-902, script ~910-958, `sbStorage` uses ~1386-1420)

**Interfaces:**
- Consumes: `sb.rpc('is_admin')` from Task 1.
- Produces: DOM ids `loginForm`, `email`, `pwd`, `loginBtn`, `err`, `newPwd`, `newPwd2`, `changePwdBtn`, `sessionEmail`; functions `checkAdmin(): Promise<boolean>`, `login()`, `logout()`, `changePassword()`.

- [ ] **Step 1: Write the browser smoke test** (`$SCRATCH/bin/admin-smoke.mjs`, playwright-core driving system Chrome, `BASE_URL` env). Cases:
  - `wrong password`: error text is shown and the password field is empty.
  - `non-admin`: a throwaway account sees "관리자 권한이 없는 계정입니다" and stays on the gate.
  - `admin login`: the dashboard is shown, the events list renders, and `#sessionEmail` shows the email.
  - `reload keeps session`.
  - `password mismatch`: shows a toast, with no API call.
  - `page storage upload/remove`: uses the page's own `sb` client on `zz-probe/`.
  - `logout`: the gate is shown.
- [ ] **Step 2: Run it against the current page, served locally (red).** Expected: FAIL at `admin login`, because there is no email field.
- [ ] **Step 3: Implement.** Changes:
  - The gate becomes a `<form id="loginForm">` with email and password inputs (`autocomplete` username/current-password) and the error `<p id="err">`.
  - Use one client: `createClient(URL, ANON, { db: { schema }, auth: { storage: window.sessionStorage } })`. Replace every `sbStorage.storage` with `sb.storage`.
  - `login()` trims the email, calls `signInWithPassword`, then `checkAdmin()`. A non-admin is signed out. The button is disabled while the request runs.
  - Error copy:
    - wrong credentials: "이메일 또는 비밀번호가 올바르지 않습니다"
    - missing input: "이메일과 비밀번호를 입력하세요"
    - network error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요"
  - On load, `getSession()` plus `checkAdmin()` decides whether to enter the dashboard. `onAuthStateChange('SIGNED_OUT')` while the dashboard is open reloads the page. `logout()` signs out.
  - Settings gets a "비밀번호 변경" card. It rejects fewer than 8 characters ("비밀번호는 8자 이상이어야 합니다") and mismatches ("두 비밀번호가 일치하지 않습니다"), then calls `auth.updateUser({ password })`. The 세션 card shows the logged-in email.
  - Remove `PWD` and `admin_ok`.
- [ ] **Step 4: Run the smoke test locally against the live API.** Expected: all cases PASS. Also run `node --check` on the extracted inline script, and `grep -nE "PWD|admin_ok|sbStorage" admin/index.html` → no output.
- [ ] **Step 5: Commit and push only `admin/index.html`; check the live page.**

```bash
git add admin/index.html && git commit -m "Admin: log in with Supabase Auth accounts instead of a password in the page source" && git push origin main
```

Expected after 1–2 minutes: `curl -s https://cuong-trading.hsweb.pics/admin/ | grep -c signInWithPassword` ≥ 1, and the smoke test PASSes with `BASE_URL=https://cuong-trading.hsweb.pics`.

### Task 3: Lockdown, final verification, docs

**Files:**
- Create: `supabase/02-lockdown.sql`
- Modify: `.dockerignore`
- Commit: `docs/superpowers/specs/2026-11-22-admin-security-design.md`, this plan, `supabase/*`

**Interfaces:**
- Consumes: the Task 1 policies and admin account; the Task 2 page already live.

- [ ] **Step 1: Save a rollback script.** Write `$SCRATCH/sql/rollback-lockdown.sql`, which recreates the dropped policies and `grant all ... to anon, authenticated`, so the pre-change state can be restored.
- [ ] **Step 2: Write `supabase/02-lockdown.sql`** (idempotent). For each table: drop `public_write`, `revoke all from anon`, `grant select to anon`, revoke insert/update/delete/truncate/references/trigger from `public`, and revoke truncate/references/trigger from `authenticated`. Drop the three `cuong_public_*` write policies on storage. End with `notify pgrst, 'reload schema'`.
- [ ] **Step 3: Apply it, then run the check script with the admin credentials.** Expected: every check PASSes, with anon reads still 15/3/1/52 rows.
- [ ] **Step 4: Run the browser smoke test against the live site.** Expected: all PASS.
- [ ] **Step 5: Commit and push.** Add `docs` and `supabase` to `.dockerignore`, then commit and push:

```bash
git add .dockerignore docs supabase && git commit -m "Lock Supabase writes to admin accounts; add security SQL, checks and design docs" && git push origin main
```

Expected: `curl -s -o /dev/null -w "%{http_code}" https://cuong-trading.hsweb.pics/supabase/02-lockdown.sql` is 404 after the deploy.
- [ ] **Step 6: Update the memory notes.** In `deploy-and-cache-workflow`, the anon key is now read-only. Add an admin-auth memory: login model, allowlist, how to add or reset an admin.
