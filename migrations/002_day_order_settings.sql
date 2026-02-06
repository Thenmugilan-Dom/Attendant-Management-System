-- ═══════════════════════════════════════════════════════════════════════
-- DAY ORDER SETTINGS TABLE - Timetable Day Order Management
-- ═══════════════════════════════════════════════════════════════════════
-- 
-- PURPOSE: Track cyclic day order (Day 1, Day 2, ..., Day 6) for timetable
-- The day order continues sequentially and can be changed by admin
-- When changed, it continues from the new day order from that date forward
-- 
-- USAGE: Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- DAY_ORDER_SETTINGS TABLE
-- Stores the current day order setting and tracks changes
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS day_order_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL DEFAULT 'General',
  day_order INTEGER NOT NULL CHECK (day_order >= 1 AND day_order <= 6),
  effective_date DATE NOT NULL,
  changed_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  is_holiday BOOLEAN DEFAULT FALSE,
  holiday_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint for one entry per department per date
CREATE UNIQUE INDEX IF NOT EXISTS idx_day_order_department_date 
ON day_order_settings(department, effective_date);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_day_order_effective_date ON day_order_settings(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_day_order_department ON day_order_settings(department);

-- ───────────────────────────────────────────────────────────────────────
-- DAY_ORDER_CONFIG TABLE
-- Stores the total number of days in the cycle and starting day
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS day_order_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL UNIQUE DEFAULT 'General',
  total_days INTEGER NOT NULL DEFAULT 6 CHECK (total_days >= 1 AND total_days <= 10),
  current_day_order INTEGER NOT NULL DEFAULT 1 CHECK (current_day_order >= 1),
  last_updated_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────────
-- Function to get current day order for a department
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_current_day_order(p_department TEXT DEFAULT 'General')
RETURNS TABLE(day_order INTEGER, is_holiday BOOLEAN, holiday_name TEXT) AS $$
DECLARE
  v_config RECORD;
  v_last_setting RECORD;
  v_days_passed INTEGER;
  v_calculated_day INTEGER;
BEGIN
  -- Get config for department
  SELECT * INTO v_config 
  FROM day_order_config 
  WHERE department = p_department;
  
  -- If no config exists, create default
  IF NOT FOUND THEN
    INSERT INTO day_order_config (department, total_days, current_day_order, last_updated_date)
    VALUES (p_department, 6, 1, CURRENT_DATE)
    RETURNING * INTO v_config;
  END IF;
  
  -- Check if there's an explicit setting for today
  SELECT * INTO v_last_setting
  FROM day_order_settings
  WHERE department = p_department
    AND effective_date = CURRENT_DATE;
  
  IF FOUND THEN
    -- Return the explicit setting for today
    RETURN QUERY SELECT v_last_setting.day_order, v_last_setting.is_holiday, v_last_setting.holiday_name;
    RETURN;
  END IF;
  
  -- Get the most recent setting before today
  SELECT * INTO v_last_setting
  FROM day_order_settings
  WHERE department = p_department
    AND effective_date < CURRENT_DATE
    AND is_holiday = FALSE
  ORDER BY effective_date DESC
  LIMIT 1;
  
  IF FOUND THEN
    -- Calculate days passed since last setting (excluding holidays)
    v_days_passed := CURRENT_DATE - v_last_setting.effective_date;
    v_calculated_day := ((v_last_setting.day_order - 1 + v_days_passed) % v_config.total_days) + 1;
    RETURN QUERY SELECT v_calculated_day, FALSE::BOOLEAN, NULL::TEXT;
  ELSE
    -- Use config's current day order
    v_days_passed := CURRENT_DATE - v_config.last_updated_date;
    v_calculated_day := ((v_config.current_day_order - 1 + v_days_passed) % v_config.total_days) + 1;
    RETURN QUERY SELECT v_calculated_day, FALSE::BOOLEAN, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────
-- Modify teacher_subjects table to use day_order instead of day_of_week
-- ───────────────────────────────────────────────────────────────────────

-- Add day_order column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teacher_subjects' AND column_name = 'day_order'
  ) THEN
    ALTER TABLE teacher_subjects ADD COLUMN day_order INTEGER CHECK (day_order >= 1 AND day_order <= 10);
  END IF;
END $$;

-- Create index on day_order
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_day_order ON teacher_subjects(day_order);

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════════════

SELECT 'Day Order tables created successfully!' as status;

-- Check tables exist
SELECT 
  'day_order_settings' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'day_order_settings')
    THEN '✓ Created' ELSE '✗ Missing' END as status
UNION ALL
SELECT 
  'day_order_config' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'day_order_config')
    THEN '✓ Created' ELSE '✗ Missing' END as status;
