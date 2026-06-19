-- Migration 005: Add project_type to sites
-- Short = renovation/repair (up to 1-2 months, no stages)
-- Long  = construction (8 months–1.5 years, color-coded stages)

alter table sites
  add column if not exists project_type text not null default 'short'
    check (project_type in ('short', 'long'));

-- Stage definitions live in a separate table for long projects
create table if not exists site_stages (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references users(id) on delete cascade,
  site_id     uuid not null references sites(id) on delete cascade,
  name_en     text not null,
  name_th     text not null default '',
  color       text not null default '#6366F1',
  position    int  not null default 0,
  started_at  timestamptz,
  completed_at timestamptz,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table site_stages enable row level security;

create policy "site_stages_select" on site_stages for select
  using (owner_id = auth.uid() or exists (
    select 1 from users where auth_id = auth.uid() and role = 'technical_admin'
  ));
create policy "site_stages_insert" on site_stages for insert
  with check (owner_id = auth.uid());
create policy "site_stages_update" on site_stages for update
  using (owner_id = auth.uid());
create policy "site_stages_delete" on site_stages for delete
  using (owner_id = auth.uid());

create index if not exists idx_site_stages_site on site_stages(site_id);
