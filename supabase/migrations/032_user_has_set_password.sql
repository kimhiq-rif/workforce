-- Migration 032: track whether user has set their own password after first magic-link login
alter table users
  add column if not exists has_set_password boolean not null default false;
