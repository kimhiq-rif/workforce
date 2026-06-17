-- Copyright © 2026 Workforce. All rights reserved.
-- Extend suppliers and receipts tables for app requirements

alter table suppliers
  add column if not exists category text,
  add column if not exists qr_code_data text,
  add column if not exists contact_phone text;

-- Rename phone to contact_phone if phone column exists
-- (Using separate column to preserve existing data)

-- Extend receipts table with fields needed for app
alter table receipts
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists photo_url text,
  add column if not exists submitted_by uuid references users(id);

-- Extend advances table with status
alter table advances
  add column if not exists status text not null default 'pending',
  add column if not exists reason text;

-- Extend sites table with severity_score
alter table sites
  add column if not exists severity_score numeric(5,2) default 0;

-- Extend workday_settings for new fields
alter table workday_settings
  add column if not exists start_time text default '08:00',
  add column if not exists end_time text default '17:00',
  add column if not exists late_threshold_minutes integer default 15,
  add column if not exists half_day_cutoff_time text default '12:00',
  add column if not exists rain_block_after text default '13:00',
  add column if not exists daily_wage_default numeric(10,2) default 500;

-- Extend push_subscriptions with owner_id and device_name
alter table push_subscriptions
  add column if not exists owner_id uuid references users(id),
  add column if not exists device_name text;
