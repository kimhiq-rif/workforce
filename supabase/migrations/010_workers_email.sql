-- Migration 010: Add email column to workers
-- Needed for future worker login / invite flow improvements

alter table workers
  add column if not exists email text;
