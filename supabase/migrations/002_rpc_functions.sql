-- Copyright © 2026 Workforce. All rights reserved.
-- Additional RPC functions

-- ─── Update owner admin code (for Settings security section) ─────────────────
create or replace function update_owner_admin_code(
  p_owner_id uuid,
  p_new_code text
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- Only allow the owner themselves to change their own code
  if auth.uid() != (select auth_id from users where id = p_owner_id) then
    raise exception 'Permission denied';
  end if;

  if length(p_new_code) < 4 then
    raise exception 'Code must be at least 4 characters';
  end if;

  update users
  set admin_code_hash = crypt(p_new_code, gen_salt('bf'))
  where id = p_owner_id and role = 'owner';
end;
$$;

-- Grant execute to authenticated users
grant execute on function update_owner_admin_code to authenticated;

-- ─── Verify admin code (for field actions requiring owner confirmation) ────────
create or replace function verify_admin_code(
  p_owner_id uuid,
  p_code text
) returns boolean
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_hash text;
begin
  select admin_code_hash into v_hash
  from users
  where id = p_owner_id and role = 'owner';

  if v_hash is null then return false; end if;
  return (v_hash = crypt(p_code, v_hash));
end;
$$;

grant execute on function verify_admin_code to authenticated;

-- ─── Add admin_code_hash column to users if not exists ────────────────────────
alter table users add column if not exists admin_code_hash text;
