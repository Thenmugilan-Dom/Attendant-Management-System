-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION: Add Class Login Credentials
-- ═══════════════════════════════════════════════════════════════════════
-- PURPOSE: Enable shared class login - one credential per class that any teacher can use
-- DATE: February 17, 2026
-- ═══════════════════════════════════════════════════════════════════════

-- Add class login credentials columns to classes table
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS class_username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS class_password TEXT;

-- Create index for faster login lookups
CREATE INDEX IF NOT EXISTS idx_classes_username ON classes(class_username);

-- Add comments
COMMENT ON COLUMN classes.class_username IS 'Shared class login username (e.g., CS101-A). Any teacher can use this to start sessions for the class.';
COMMENT ON COLUMN classes.class_password IS 'Shared class login password. Plain text for simplicity in institutional settings.';

-- Example: Set default credentials for existing classes (OPTIONAL - run manually if needed)
-- UPDATE classes 
-- SET 
--   class_username = LOWER(REPLACE(class_name || '-' || COALESCE(section, ''), ' ', '')),
--   class_password = 'class123'
-- WHERE class_username IS NULL;

SELECT '✅ Class login credentials columns added successfully!' as result;
