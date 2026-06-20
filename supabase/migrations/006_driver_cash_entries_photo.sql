-- Migration 006: Add photo proof + GPS to driver cash entries
ALTER TABLE driver_cash_entries
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS gps_lat   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_lng   DOUBLE PRECISION;

COMMENT ON COLUMN driver_cash_entries.photo_url IS 'Photo proof of cash handover';
COMMENT ON COLUMN driver_cash_entries.gps_lat   IS 'Latitude at moment of handover';
COMMENT ON COLUMN driver_cash_entries.gps_lng   IS 'Longitude at moment of handover';
