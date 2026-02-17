-- ═══════════════════════════════════════════════════════════════════════
-- 🔐 CLASS LOGIN CREDENTIALS - QUICK FIX
-- ═══════════════════════════════════════════════════════════════════════
-- Run this ENTIRE script in Supabase SQL Editor to enable class login
-- ═══════════════════════════════════════════════════════════════════════

-- Step 1: Add columns (safe - uses IF NOT EXISTS)
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS class_username TEXT,
ADD COLUMN IF NOT EXISTS class_password TEXT;

-- Step 2: Make class_username unique (only if column exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'classes' AND column_name = 'class_username'
    ) THEN
        -- Drop existing constraint if it exists
        ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_class_username_key;
        -- Add unique constraint
        ALTER TABLE classes ADD CONSTRAINT classes_class_username_key UNIQUE (class_username);
    END IF;
END $$;

-- Step 3: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_classes_username ON classes(class_username);

-- Step 4: Verify columns exist
SELECT 
    CASE 
        WHEN COUNT(*) = 2 THEN '✅ SUCCESS: Both columns added!'
        ELSE '❌ ERROR: Columns not added. Check error messages above.'
    END as status
FROM information_schema.columns
WHERE table_name = 'classes' 
AND column_name IN ('class_username', 'class_password');

-- Step 5: View current classes (to see which ones need credentials)
SELECT 
    id, 
    class_name, 
    section, 
    year,
    class_username,
    class_password,
    CASE 
        WHEN class_username IS NULL THEN '⚠️ Needs credentials'
        ELSE '✅ Ready'
    END as status
FROM classes
ORDER BY class_name, section;

-- ═══════════════════════════════════════════════════════════════════════
-- OPTIONAL: Set default credentials for existing classes
-- ═══════════════════════════════════════════════════════════════════════
-- Uncomment and run these lines if you want automatic credentials:

-- UPDATE classes 
-- SET 
--   class_username = LOWER(REPLACE(class_name || '-' || COALESCE(section, 'A'), ' ', '-')),
--   class_password = 'class123'
-- WHERE class_username IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- After running this:
-- 1. Refresh your browser
-- 2. Edit a class in admin panel
-- 3. Set class_username and class_password manually
-- 4. Try saving - should work now! ✅
-- ═══════════════════════════════════════════════════════════════════════
