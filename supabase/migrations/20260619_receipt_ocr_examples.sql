-- Receipt OCR learning examples
-- Each confirmed receipt save becomes a training example for this owner
CREATE TABLE IF NOT EXISTS receipt_ocr_examples (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id         UUID NOT NULL,
  image_url        TEXT,
  correct_merchant  TEXT,
  correct_description TEXT,
  correct_amount   DECIMAL(12, 2) NOT NULL,
  correct_date     DATE,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Index for fast per-owner lookup
CREATE INDEX IF NOT EXISTS idx_ocr_examples_owner ON receipt_ocr_examples (owner_id, created_at DESC);

-- Only owner can read/write their own examples
ALTER TABLE receipt_ocr_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON receipt_ocr_examples
  FOR ALL USING (owner_id = auth.uid());
