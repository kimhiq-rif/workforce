-- Copyright © 2026 Workforce. All rights reserved.
-- Calendar events: tasks and meetings with push reminders

create table if not exists calendar_events (
  id               uuid primary key default uuid_generate_v4(),
  owner_id         uuid not null references users(id) on delete cascade,
  title            text not null,
  event_type       text not null default 'task' check (event_type in ('task', 'meeting')),
  event_date       date not null,
  event_time       time,
  site_id          uuid references sites(id),
  notes            text,
  reminder_minutes integer default 15,
  push_sent        boolean not null default false,
  is_done          boolean not null default false,
  created_at       timestamptz not null default now()
);

alter table calendar_events enable row level security;

create policy "calendar_events_all" on calendar_events
  using (owner_id = get_owner_id())
  with check (owner_id = get_owner_id());
