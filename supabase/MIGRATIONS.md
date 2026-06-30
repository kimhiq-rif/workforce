# Workforce — Migration History

DB: `keihzjpkshrucqwiwzoy.supabase.co` (Supabase, ap-southeast-2 Sydney)  
Migrations applied manually via Supabase SQL Editor.  
Tracking table: `public.migrations_log` (created in migration 034).

---

## Status legend
| Symbol | Meaning |
|--------|---------|
| ✅ | Applied to production |
| ⚠️ | Applied but has naming conflict |
| ❓ | Unknown — verify in `migrations_log` table |

---

## Migration list

| File | Status | Applied | Description |
|------|--------|---------|-------------|
| `001_initial_schema.sql` | ✅ | ~2026-06-16 | Full initial schema: users, sites, workers, attendance_events, receipts, advances, suppliers, site_day_status_events, calendar_events, site_stages, trusted_devices, audit_log, workday_settings, push_subscriptions |
| `002_rpc_functions.sql` | ✅ | ~2026-06-16 | RPC functions: `get_owner_id()`, attendance streak helpers |
| `003_suppliers_extend.sql` | ✅ | ~2026-06-16 | Extend suppliers table |
| `004_fix_users_rls_and_grants.sql` | ✅ | ~2026-06-17 | Fix RLS policies on users table + GRANT permissions |
| `005_receipts_gps_payment_type.sql` | ✅ | ~2026-06-17 | Add GPS + payment_type columns to receipts |
| `005_site_project_type.sql` | ✅ | ~2026-06-17 | Add project_type column to sites (short/long) |
| `006_calendar_events.sql` | ✅ | ~2026-06-17 | Calendar events table |
| `006_driver_cash_entries_photo.sql` | ✅ | ~2026-06-17 | Add photo support to driver_cash_entries |
| `007_driver_cash_entries.sql` | ✅ | ~2026-06-18 | Driver cash entries table |
| `007_passkeys.sql` | ✅ | ~2026-06-18 | Passkeys table (Face ID / Touch ID) |
| `008_app_access.sql` | ✅ | ~2026-06-18 | App access control |
| `008_receipt_status_extend.sql` | ✅ | ~2026-06-18 | Extend receipt status enum |
| `009_stage_reports.sql` | ✅ | ~2026-06-18 | Stage reports table |
| `010_workers_email.sql` | ✅ | ~2026-06-18 | Add email column to workers |
| *(011, 012 — skipped)* | — | — | Numbers reserved, not used |
| `013_daily_report_snapshots.sql` | ✅ | ~2026-06-19 | Daily report snapshots table |
| *(014–018 — skipped)* | — | — | Numbers reserved, not used |
| `019_annual_report_snapshots.sql` | ✅ | ~2026-06-19 | Annual report snapshots table |
| `020_fix_worker_attendance_streak_security_invoker.sql` | ✅ | ~2026-06-19 | Fix SECURITY INVOKER on streak function |
| `021_attendance_absence_fields.sql` | ✅ | ~2026-06-20 | Absence fields on attendance_events |
| `022_hosted_company_brand.sql` | ✅ | ~2026-06-20 | Hosted company brand settings |
| `023_site_daily_notes.sql` | ✅ | ~2026-06-20 | Daily notes per site |
| `024_halfmonth_payroll_tables.sql` | ✅ | ~2026-06-21 | Halfmonth payroll tables |
| `025_overtime_and_corrections.sql` | ✅ | ~2026-06-21 | Overtime + corrections tables |
| `026_allow_same_day_site_transfers.sql` | ✅ | ~2026-06-21 | Allow same-day site transfers |
| `027_site_transfer_events.sql` | ✅ | ~2026-06-21 | Site transfer events log |
| `028_login_attempts.sql` | ✅ | 2026-06-24 | Login attempts table (brute-force protection) |
| `029_attendance_unique_constraint.sql` | ✅ | ~2026-06-24 | Unique constraint: owner_id+worker_id+event_date+site_id |
| `030_worker_visa_expiry.sql` | ✅ | ~2026-06-26 | Add visa_expiry_date to workers |
| `030_storage_buckets.sql` | ⚠️ | 2026-06-29 | **NAMING CONFLICT** (should be 034a). Private buckets: attendance-photos, receipt-photos. Public: site-photos, calendar-photos RLS fix. Store path in DB, use signed URLs (15 min TTL) |
| `031_worker_age.sql` | ✅ | ~2026-06-26 | Add age column to workers |
| `032_user_has_set_password.sql` | ✅ | 2026-06-26 | Add has_set_password boolean to users (force password setup flow) |
| `033_calendar_events_image.sql` | ✅ | ~2026-06-29 | Add image_url/lat/lng/taken_at to calendar_events |
| `034_migrations_log.sql` | ✅ | 2026-06-30 | migrations_log tracking table + backfill |
| `20260619_receipt_ocr_examples.sql` | ✅ | 2026-06-19 | OCR examples table for receipt learning |
| `20260621_worker_photos_bucket.sql` | ✅ | 2026-06-21 | Worker photos storage bucket |

---

## Naming conflicts

The following files share the `030_` prefix due to a merge/sync issue between the two local working directories (`Documents/Codex/projects/workforce` and `.claude/workforce`):

- `030_worker_visa_expiry.sql` — original 030, applied earlier
- `030_storage_buckets.sql` — should have been 034, applied 2026-06-29

Both are applied to production. The `migrations_log` table (migration 034) uses the full filename as the unique key, so both are tracked correctly.

---

## How to apply a new migration

1. Write the SQL file: `supabase/migrations/NNN_description.sql`
2. Open Supabase Dashboard → SQL Editor
3. Paste and run the SQL
4. Record in migrations_log:
```sql
insert into migrations_log (name, applied_at, description)
values ('NNN_description', now(), 'Short description')
on conflict (name) do nothing;
```
5. Update this file with ✅ and date

---

## Production DB checks

```sql
-- Which migrations are recorded?
select name, applied_at, description from migrations_log order by applied_at;

-- Check for the naming conflict
select name from migrations_log where name like '030_%';
```
