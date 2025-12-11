-- Migration: Update od_requests table to support date ranges
-- Purpose: Change from single od_date to od_start_date and od_end_date
-- Date: December 11, 2025

-- STEP 1: Drop the old index if it exists
DROP INDEX IF EXISTS idx_od_requests_date;

-- STEP 2: Add new columns for date range (if they don't exist)
ALTER TABLE od_requests
  ADD COLUMN IF NOT EXISTS od_start_date DATE;

ALTER TABLE od_requests
  ADD COLUMN IF NOT EXISTS od_end_date DATE;

-- STEP 3: Migrate data from old column to new columns (if old column exists)
-- Only run if od_date column still exists
DO $$ 
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='od_requests' AND column_name='od_date'
  ) THEN
    UPDATE od_requests 
    SET od_start_date = od_date, 
        od_end_date = od_date 
    WHERE od_start_date IS NULL;
  END IF;
END $$;

-- STEP 4: Make new columns NOT NULL
ALTER TABLE od_requests
  ALTER COLUMN od_start_date SET NOT NULL;

ALTER TABLE od_requests
  ALTER COLUMN od_end_date SET NOT NULL;

-- STEP 5: Drop old column (if it exists)
ALTER TABLE od_requests
  DROP COLUMN IF EXISTS od_date CASCADE;

-- STEP 6: Create new indexes for date range columns
CREATE INDEX IF NOT EXISTS idx_od_requests_start_date ON od_requests(od_start_date);
CREATE INDEX IF NOT EXISTS idx_od_requests_end_date ON od_requests(od_end_date);

-- STEP 7: Verify the migration
SELECT 'Migration completed successfully!' as status;
SELECT COUNT(*) as total_od_requests FROM od_requests;
SELECT 
  'Columns verified:' as check,
  CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='od_requests' AND column_name='od_start_date') THEN '✅ od_start_date' ELSE '❌ od_start_date missing' END as od_start_date,
  CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='od_requests' AND column_name='od_end_date') THEN '✅ od_end_date' ELSE '❌ od_end_date missing' END as od_end_date,
  CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='od_requests' AND column_name='od_date') THEN '❌ old od_date still exists' ELSE '✅ old od_date removed' END as old_od_date;
