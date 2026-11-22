-- Cuong admin auth, part 2 of 2: remove public write access (safe to re-run).
--
-- Apply after 01-admin-auth.sql, once the admin page logs in with Supabase Auth
-- and cuong_trading.admins has at least one account. Visitors keep read access
-- through the public_read (tables) and cuong_public_read (bucket) policies.
-- Check the result with: node supabase/verify-security.mjs

do $$
begin
    if not exists (select 1 from cuong_trading.admins) then
        raise exception 'cuong_trading.admins is empty: add an admin first, or nobody could edit the site';
    end if;
end $$;

do $$
declare
    t text;
begin
    foreach t in array array['events', 'exchanges', 'reviews', 'site_texts'] loop
        execute format('drop policy if exists public_write on cuong_trading.%I', t);
        execute format('revoke all on table cuong_trading.%I from anon', t);
        execute format('grant select on table cuong_trading.%I to anon', t);
        execute format('revoke insert, update, delete, truncate, references, trigger on table cuong_trading.%I from public', t);
        execute format('revoke truncate, references, trigger on table cuong_trading.%I from authenticated', t);
    end loop;
end $$;

drop policy if exists cuong_public_write on storage.objects;
drop policy if exists cuong_public_update on storage.objects;
drop policy if exists cuong_public_delete on storage.objects;

notify pgrst, 'reload schema';
