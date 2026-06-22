-- Per-site daily note: the owner leaves a note on a specific site for "today".
-- It is pushed to the field manager(s) who reported attendance at that site that
-- day, and shown in-app on the site. Self-expires by note_date (one per site/day);
-- the midnight reset also deletes stale rows.

create table if not exists site_daily_notes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references users(id),
  site_id     uuid not null references sites(id) on delete cascade,
  note        text not null,
  note_date   date not null default (now() at time zone 'Asia/Bangkok')::date,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (site_id, note_date)
);

alter table site_daily_notes enable row level security;

-- Everyone in the owner org can read (managers need to see the note).
create policy "site_daily_notes_select" on site_daily_notes for select
  using (owner_id = get_owner_id());

-- Only the owner may create / update / delete notes.
create policy "site_daily_notes_insert" on site_daily_notes for insert
  with check (
    owner_id = get_owner_id()
    and exists (select 1 from users where auth_id = auth.uid() and role = 'owner')
  );

create policy "site_daily_notes_update" on site_daily_notes for update
  using (
    owner_id = get_owner_id()
    and exists (select 1 from users where auth_id = auth.uid() and role = 'owner')
  );

create policy "site_daily_notes_delete" on site_daily_notes for delete
  using (
    owner_id = get_owner_id()
    and exists (select 1 from users where auth_id = auth.uid() and role = 'owner')
  );

create index if not exists idx_site_daily_notes_site_date
  on site_daily_notes(site_id, note_date);

create trigger site_daily_notes_updated_at
  before update on site_daily_notes
  for each row execute function update_updated_at_column();
