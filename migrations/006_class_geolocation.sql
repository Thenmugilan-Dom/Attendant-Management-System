-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION 006: Add Geolocation to Classes
-- ═══════════════════════════════════════════════════════════════════════
-- 
-- PURPOSE: Add optional geolocation fields to classes table
--          When set, students can only mark attendance when near the class location
-- 
-- FIELDS ADDED:
--   • latitude (DECIMAL) - Class location latitude (optional)
--   • longitude (DECIMAL) - Class location longitude (optional)  
--   • location_radius (INTEGER) - Allowed radius in meters (default: 100m)
-- 
-- USAGE: Run this file in Supabase SQL Editor
-- DATE: February 10, 2026
-- ═══════════════════════════════════════════════════════════════════════

-- Add latitude column
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8) DEFAULT NULL;

-- Add longitude column
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8) DEFAULT NULL;

-- Add location_radius column (in meters, default 100m)
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS location_radius INTEGER DEFAULT 100;

-- Add comment for documentation
COMMENT ON COLUMN classes.latitude IS 'Class location latitude (optional). If set, students must be near this location to mark attendance.';
COMMENT ON COLUMN classes.longitude IS 'Class location longitude (optional). If set, students must be near this location to mark attendance.';
COMMENT ON COLUMN classes.location_radius IS 'Allowed radius in meters from class location. Default: 100 meters.';

-- Verification query
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'classes' 
  AND column_name IN ('latitude', 'longitude', 'location_radius');

SELECT '✅ Geolocation columns added to classes table successfully!' as status;
