-- Migration 031: age on workers
alter table workers
  add column if not exists age smallint;
