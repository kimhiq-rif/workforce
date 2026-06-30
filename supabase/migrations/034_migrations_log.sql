-- Migration 034: migrations_log tracking table
-- Tracks which migrations have been applied to production.
-- Solves the problem of duplicate/skipped migration numbers and
-- the 030_storage_buckets vs 030_worker_visa_expiry conflict.

create table if not exists public.migrations_log (
  id          serial primary key,
  name        text        not null unique,
  applied_at  timestamptz not null default now(),
  description text
);

comment on table public.migrations_log is
  'Manual migration tracking. One row per applied migration file.';

-- RLS: service role only (no user-facing access needed)
alter table public.migrations_log enable row level security;

create policy "migrations_log_service_only"
  on public.migrations_log
  for all
  to service_role
  using (true)
  with check (true);

-- Backfill all migrations known to be applied as of 2026-06-30
insert into public.migrations_log (name, applied_at, description) values
  ('001_initial_schema',                                 '2026-06-16'::timestamptz, 'Full initial schema: users, sites, workers, attendance_events, receipts, advances, suppliers, etc.'),
  ('002_rpc_functions',                                  '2026-06-16'::timestamptz, 'RPC functions: get_owner_id(), attendance streak helpers'),
  ('003_suppliers_extend',                               '2026-06-16'::timestamptz, 'Extend suppliers table'),
  ('004_fix_users_rls_and_grants',                       '2026-06-17'::timestamptz, 'Fix RLS policies on users + GRANT permissions'),
  ('005_receipts_gps_payment_type',                      '2026-06-17'::timestamptz, 'Add GPS + payment_type to receipts'),
  ('005_site_project_type',                              '2026-06-17'::timestamptz, 'Add project_type to sites (short/long)'),
  ('006_calendar_events',                                '2026-06-17'::timestamptz, 'Calendar events table'),
  ('006_driver_cash_entries_photo',                      '2026-06-17'::timestamptz, 'Add photo support to driver_cash_entries'),
  ('007_driver_cash_entries',                            '2026-06-18'::timestamptz, 'Driver cash entries table'),
  ('007_passkeys',                                       '2026-06-18'::timestamptz, 'Passkeys table (Face ID / Touch ID)'),
  ('008_app_access',                                     '2026-06-18'::timestamptz, 'App access control'),
  ('008_receipt_status_extend',                          '2026-06-18'::timestamptz, 'Extend receipt status enum'),
  ('009_stage_reports',                                  '2026-06-18'::timestamptz, 'Stage reports table'),
  ('010_workers_email',                                  '2026-06-18'::timestamptz, 'Add email column to workers'),
  ('013_daily_report_snapshots',                         '2026-06-19'::timestamptz, 'Daily report snapshots table'),
  ('019_annual_report_snapshots',                        '2026-06-19'::timestamptz, 'Annual report snapshots table'),
  ('020_fix_worker_attendance_streak_security_invoker',  '2026-06-19'::timestamptz, 'Fix SECURITY INVOKER on streak function'),
  ('021_attendance_absence_fields',                      '2026-06-20'::timestamptz, 'Absence fields on attendance_events'),
  ('022_hosted_company_brand',                           '2026-06-20'::timestamptz, 'Hosted company brand settings'),
  ('023_site_daily_notes',                               '2026-06-20'::timestamptz, 'Daily notes per site'),
  ('024_halfmonth_payroll_tables',                       '2026-06-21'::timestamptz, 'Halfmonth payroll tables'),
  ('025_overtime_and_corrections',                       '2026-06-21'::timestamptz, 'Overtime + corrections tables'),
  ('026_allow_same_day_site_transfers',                  '2026-06-21'::timestamptz, 'Allow same-day site transfers'),
  ('027_site_transfer_events',                           '2026-06-21'::timestamptz, 'Site transfer events log'),
  ('028_login_attempts',                                 '2026-06-24'::timestamptz, 'Login attempts table for brute-force protection'),
  ('029_attendance_unique_constraint',                   '2026-06-24'::timestamptz, 'Unique constraint: owner_id+worker_id+event_date+site_id'),
  ('030_worker_visa_expiry',                             '2026-06-26'::timestamptz, 'Add visa_expiry_date to workers'),
  ('031_worker_age',                                     '2026-06-26'::timestamptz, 'Add age column to workers'),
  ('032_user_has_set_password',                          '2026-06-26'::timestamptz, 'Add has_set_password boolean to users'),
  ('033_calendar_events_image',                          '2026-06-29'::timestamptz, 'Add image_url/lat/lng/taken_at to calendar_events'),
  -- naming conflict: should have been 034a — tracked here with real name
  ('030_storage_buckets',                                '2026-06-29'::timestamptz, 'NAMING CONFLICT (applied as 030). Private buckets for attendance/receipt photos, signed URL pattern, site-photos public, calendar-photos RLS'),
  ('20260619_receipt_ocr_examples',                      '2026-06-19'::timestamptz, 'OCR examples table for receipt learning'),
  ('20260621_worker_photos_bucket',                      '2026-06-21'::timestamptz, 'Worker photos storage bucket'),
  ('034_migrations_log',                                 '2026-06-30'::timestamptz, 'This table — migration tracking + backfill')
on conflict (name) do nothing;
