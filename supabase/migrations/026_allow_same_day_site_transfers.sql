-- Allow a worker to be reported at more than one site on the same day.
-- Duplicate attendance is still prevented per owner/worker/date/site.

drop index if exists attendance_events_owner_worker_date_unique;

create unique index if not exists attendance_events_owner_worker_date_site_unique
  on attendance_events(owner_id, worker_id, event_date, site_id);
