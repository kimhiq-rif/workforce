-- Fix app auth/profile access and recursive users RLS.
-- Run this in Supabase SQL Editor or via Supabase CLI before QA.

-- Make sure API roles can access public schema objects.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;

-- The original get_owner_id queried public.users from inside users policies,
-- which can recurse. SECURITY DEFINER lets the helper resolve ownership
-- without being filtered by the caller's RLS policy.
create or replace function public.get_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select owner_id from public.users where auth_id = auth.uid()),
    (select id from public.users where auth_id = auth.uid() and role = 'owner')
  );
$$;

grant execute on function public.get_owner_id() to authenticated, service_role;

drop policy if exists "users_select" on public.users;
drop policy if exists "users_update_own" on public.users;

create policy "users_select" on public.users
for select
to authenticated
using (
  auth.uid() is not null
  and (
    auth_id = auth.uid()
    or id = public.get_owner_id()
    or owner_id = public.get_owner_id()
  )
);

create policy "users_update_own" on public.users
for update
to authenticated
using (auth_id = auth.uid())
with check (auth_id = auth.uid());

-- Owner rows are created by server-side service role bootstrap.
-- Keep client inserts blocked by omission; service_role bypasses RLS.
