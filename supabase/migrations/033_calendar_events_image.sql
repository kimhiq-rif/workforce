-- Migration 033: Add image storage fields to calendar_events
-- Follows the same pattern as attendance_events (photo_url, photo_lat, photo_lng)
-- and receipts (source_photo_url, gps_lat, gps_lng)

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS image_url      text,
  ADD COLUMN IF NOT EXISTS image_lat      double precision,
  ADD COLUMN IF NOT EXISTS image_lng      double precision,
  ADD COLUMN IF NOT EXISTS image_taken_at timestamptz;

COMMENT ON COLUMN calendar_events.image_url      IS 'Public URL of the photo stored in calendar-photos bucket';
COMMENT ON COLUMN calendar_events.image_lat      IS 'GPS latitude at moment of photo capture';
COMMENT ON COLUMN calendar_events.image_lng      IS 'GPS longitude at moment of photo capture';
COMMENT ON COLUMN calendar_events.image_taken_at IS 'Timestamp (UTC) when the photo was taken on the device';
