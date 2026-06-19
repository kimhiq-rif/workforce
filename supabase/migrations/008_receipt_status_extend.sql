-- Copyright © 2026 Workforce. All rights reserved.
-- Extend receipt_status enum with values used by the app

alter type receipt_status add value if not exists 'pending';
alter type receipt_status add value if not exists 'approved';
alter type receipt_status add value if not exists 'disputed';
alter type receipt_status add value if not exists 'pending_sorting';
alter type receipt_status add value if not exists 'paid_pending_sorting';

-- Add paid_at and paid_by columns if not present
alter table receipts
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by uuid references users(id);

-- notes column for QR extra info
alter table receipts
  add column if not exists notes text;
