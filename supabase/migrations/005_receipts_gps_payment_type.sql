-- Migration 005: Add GPS location + payment type to receipts
-- Run in Supabase SQL editor before deploying the corresponding app version.

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS gps_lat      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_lng      DOUBLE PRECISION;

COMMENT ON COLUMN receipts.payment_type IS 'qr | cash — how the driver intends to settle';
COMMENT ON COLUMN receipts.gps_lat      IS 'Latitude at time of photo capture';
COMMENT ON COLUMN receipts.gps_lng      IS 'Longitude at time of photo capture';
