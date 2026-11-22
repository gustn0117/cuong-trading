-- Cuong admin auth, part 1 of 2 (additive; safe to re-run).
--
-- Adds an allowlist of admin accounts and admin-only write policies on the
-- cuong_trading tables and the cuong-trading storage bucket. The old
-- public_write / cuong_public_* policies are removed separately in
-- 02-lockdown.sql, once the admin page logs in with Supabase Auth.
--
-- To make an existing Supabase Auth user an admin:
--   insert into cuong_trading.admins (user_id)
--   select id from auth.users where email = '<email>' on conflict do nothing;

create table if not exists cuong_trading.admins (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);
alter table cuong_trading.admins enable row level security;
revoke all on table cuong_trading.admins from public, anon, authenticated;

create or replace function cuong_trading.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (select 1 from cuong_trading.admins a where a.user_id = auth.uid());
$$;
revoke all on function cuong_trading.is_admin() from public, anon;
grant execute on function cuong_trading.is_admin() to authenticated, service_role;

do $$
declare
    t text;
begin
    foreach t in array array['events', 'exchanges', 'reviews', 'site_texts'] loop
        execute format('drop policy if exists admin_insert on cuong_trading.%I', t);
        execute format('drop policy if exists admin_update on cuong_trading.%I', t);
        execute format('drop policy if exists admin_delete on cuong_trading.%I', t);
        execute format('create policy admin_insert on cuong_trading.%I for insert to authenticated
                        with check ((select cuong_trading.is_admin()))', t);
        execute format('create policy admin_update on cuong_trading.%I for update to authenticated
                        using ((select cuong_trading.is_admin())) with check ((select cuong_trading.is_admin()))', t);
        execute format('create policy admin_delete on cuong_trading.%I for delete to authenticated
                        using ((select cuong_trading.is_admin()))', t);
    end loop;
end $$;

drop policy if exists cuong_admin_insert on storage.objects;
drop policy if exists cuong_admin_update on storage.objects;
drop policy if exists cuong_admin_delete on storage.objects;
create policy cuong_admin_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'cuong-trading' and (select cuong_trading.is_admin()));
create policy cuong_admin_update on storage.objects for update to authenticated
    using (bucket_id = 'cuong-trading' and (select cuong_trading.is_admin()))
    with check (bucket_id = 'cuong-trading' and (select cuong_trading.is_admin()));
create policy cuong_admin_delete on storage.objects for delete to authenticated
    using (bucket_id = 'cuong-trading' and (select cuong_trading.is_admin()));

notify pgrst, 'reload schema';
