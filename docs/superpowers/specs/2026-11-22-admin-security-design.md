# Admin security: real login + server-side write lock

Date: 2026-11-22 · Status: approved in conversation (short design)

## Why

A third party reported that the `/admin` login can be bypassed by reading the page source. Confirmed, and the real hole was deeper:

- The admin password was a constant in `admin/index.html` (`PWD`), and setting `sessionStorage.admin_ok = '1'` skipped the gate.
- Server side, every table in schema `cuong_trading` had a `public_write` policy (`ALL using (true) with check (true)` for role `public`), `anon` held full table privileges, and the `cuong-trading` storage bucket had public INSERT/UPDATE/DELETE policies. Anyone with the public anon key (shipped in `script.js`) could rewrite exchange referral links, delete reviews or upload files without ever opening `/admin`.

## Goals

- Only designated admin accounts can create, update or delete rows in `cuong_trading` tables or objects in the `cuong-trading` bucket.
- Visitors keep read access; the public site behaves exactly as before.
- No secrets in the repo: it is public on GitHub, and nginx serves every file not listed in `.dockerignore`.
- The site owner can set their own admin password.

## Non-goals

- Other sites hosted on the same Supabase server: out of scope here.
- Re-issuing the anon/service keys before they expire (2027-01-10 08:00 KST): separate follow-up.
- Hiding the admin page itself: no value once the server enforces permissions.

## Anti-goals

- Gating writes on "is logged in" (`authenticated`): on a shared Supabase server, accounts can be created by people other than the site owner, so a login alone must never grant write access.
- Downtime for visitors, or a window where the admin cannot save.

## Approaches

1. Hide, hash or change the password in JS, or put HTTP basic auth on `/admin`. Rejected: the database stays writable with the public anon key.
2. A separate backend that holds the service key. Rejected: one more server to run, and Supabase already provides auth and row-level security.
3. **Chosen:** Supabase Auth (email + password) plus RLS limited to an allowlist (`cuong_trading.admins`) through `cuong_trading.is_admin()`.

## Design

Server (idempotent SQL in `supabase/01-admin-auth.sql` and `supabase/02-lockdown.sql`, applied with the service key through pg-meta):

- `cuong_trading.admins (user_id uuid primary key references auth.users on delete cascade)`: RLS on, no policies, no grants to `anon`/`authenticated`.
- `cuong_trading.is_admin()`: `security definer`, `set search_path = ''`, true when `auth.uid()` is in `admins`; execute granted to `authenticated` and `service_role`, never `anon`.
- Tables `events`, `exchanges`, `reviews`, `site_texts`: drop `public_write`; keep public SELECT; add INSERT/UPDATE/DELETE policies `to authenticated` gated on `is_admin()`; `anon` keeps SELECT only; `authenticated` loses TRUNCATE/REFERENCES/TRIGGER.
- Bucket `cuong-trading`: drop the public INSERT/UPDATE/DELETE policies; add the same three `to authenticated` with `bucket_id = 'cuong-trading' and cuong_trading.is_admin()`. Keep the public SELECT policy (public URLs keep working).
- One admin account created with the GoTrue admin API (email pre-confirmed). The initial random password goes to the site owner, who changes it in the admin.

Admin page (`admin/index.html`):

- The gate asks for email + password and calls `sb.auth.signInWithPassword`, then `rpc('is_admin')`; a non-admin account is signed out with a message.
- Session kept in `sessionStorage` (same lifetime as the old flag); restored with `getSession()` on load; logout calls `signOut()`.
- A single Supabase client for DB and storage, so uploads carry the login session.
- Settings gets a "비밀번호 변경" card (`auth.updateUser({ password })`, minimum 8 characters, confirmation field).
- `PWD` and `admin_ok` removed.

Rollout, with no admin downtime:

1. Additive SQL (admins, is_admin, admin policies) and the admin account. The old page keeps working.
2. Deploy the new admin page and check it on the live site.
3. Lockdown SQL (drop public write policies, revoke anon writes).
4. Verify: anon writes rejected; a throwaway non-admin account rejected, then deleted; admin writes work; public reads unchanged.

Rollback: recreate the dropped policies and grants from the saved pre-change inspection.

Repo: `docs/` and `supabase/` are added to `.dockerignore`. Docs and SQL are committed only after the lockdown is live.

## Left to the builder

- Copy and styling of the email field and the password card, following the existing admin styles.
