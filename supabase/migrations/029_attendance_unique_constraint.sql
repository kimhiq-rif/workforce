-- Canonical attendance uniqueness for same-day site transfers.
-- Keep owner_id in the key so multi-tenant data cannot collide across owners.

drop index if exists attendance_events_worker_date_site_unique;
drop index if exists attendance_events_owner_worker_date_unique;

create unique index if not exists attendance_events_owner_worker_date_site_unique
  on attendance_events(owner_id, worker_id, event_date, site_id);
