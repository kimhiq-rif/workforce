-- Migration 030: visa_expiry_date on workers
alter table workers
  add column if not exists visa_expiry_date date;
