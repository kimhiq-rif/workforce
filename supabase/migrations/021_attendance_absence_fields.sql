-- Attendance absence metadata for daily/period reports.
-- Run in Supabase SQL Editor before relying on absence reasons in reports.

alter table attendance_events
  add column if not exists absence_reason text check (absence_reason in ('sick', 'day_off', 'family', 'other')),
  add column if not exists absence_note text,
  add column if not exists absence_marked_by uuid references users(id),
  add column if not exists source text;

create unique index if not exists attendance_events_owner_worker_date_unique
  on attendance_events(owner_id, worker_id, event_date);
