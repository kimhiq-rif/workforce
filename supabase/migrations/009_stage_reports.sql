-- Migration 009: Stage reports + project lifecycle fields
-- Depends on: 005_site_project_type.sql (site_stages table)

-- ─── sites: project lifecycle ────────────────────────────────────────────────
alter table sites
  add column if not exists project_target_end_date date,
  add column if not exists project_description text,
  add column if not exists closed_at timestamptz,
  add column if not exists close_reason text check (close_reason in ('completed', 'stopped_cancelled'));

-- ─── site_stages: target date per stage ─────────────────────────────────────
alter table site_stages
  add column if not exists target_end_date date,
  add column if not exists transition_note text;

-- ─── stage_reports ───────────────────────────────────────────────────────────
-- One row per completed stage, generated when owner clicks Move Stage.
-- Stores pre-computed totals + full snapshot_json for the report page.
create table if not exists stage_reports (
  id                    uuid primary key default uuid_generate_v4(),
  owner_id              uuid not null references users(id) on delete cascade,
  site_id               uuid not null references sites(id) on delete cascade,
  stage_id              uuid not null references site_stages(id) on delete cascade,

  stage_name_en         text not null,
  stage_name_th         text not null default '',
  stage_color           text not null default '#6366F1',
  period_from           date not null,
  period_to             date not null,
  duration_days         int  not null default 0,
  work_days             int  not null default 0,

  -- costs in THB
  labor_cost_thb        numeric(12,2) not null default 0,
  receipts_cost_thb     numeric(12,2) not null default 0,
  temp_workers_cost_thb numeric(12,2) not null default 0,
  overtime_cost_thb     numeric(12,2) not null default 0,
  total_cost_thb        numeric(12,2) not null default 0,

  -- workforce metrics
  worker_count          int not null default 0,

  -- exception counts (for accordion sections)
  gps_issue_count       int not null default 0,
  correction_count      int not null default 0,
  receipt_problem_count int not null default 0,
  overtime_count        int not null default 0,
  temp_worker_count     int not null default 0,

  -- full snapshot used by the report page (avoids recomputing)
  snapshot_json         jsonb,

  generated_at          timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

alter table stage_reports enable row level security;

create policy "stage_reports_select" on stage_reports for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from users
      where auth_id = auth.uid()
        and owner_id = stage_reports.owner_id
    )
  );

create policy "stage_reports_insert" on stage_reports for insert
  with check (owner_id = auth.uid());

create policy "stage_reports_update" on stage_reports for update
  using (owner_id = auth.uid());

create index if not exists idx_stage_reports_site  on stage_reports(site_id);
create index if not exists idx_stage_reports_stage on stage_reports(stage_id);
create index if not exists idx_stage_reports_owner on stage_reports(owner_id);
