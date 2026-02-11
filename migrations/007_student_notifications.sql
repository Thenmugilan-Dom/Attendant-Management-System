-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION 007: Student Notifications
-- ═══════════════════════════════════════════════════════════════════════
-- 
-- PURPOSE: Add notifications table for student updates
--          Allows teachers/admins to send important notifications to students
-- 
-- TABLES CREATED:
--   • student_notifications - Stores notifications for students
-- 
-- USAGE: Run this file in Supabase SQL Editor
-- DATE: February 10, 2026
-- ═══════════════════════════════════════════════════════════════════════

-- Student notifications table
CREATE TABLE IF NOT EXISTS student_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'success', 'alert', 'attendance', 'od')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_read BOOLEAN DEFAULT FALSE,
  is_broadcast BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_student_notifications_student_id ON student_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_student_notifications_class_id ON student_notifications(class_id);
CREATE INDEX IF NOT EXISTS idx_student_notifications_is_read ON student_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_student_notifications_created_at ON student_notifications(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE student_notifications IS 'Stores notifications for students from teachers/admins';
COMMENT ON COLUMN student_notifications.type IS 'Type of notification: info, warning, success, alert, attendance, od';
COMMENT ON COLUMN student_notifications.priority IS 'Priority level: low, normal, high, urgent';
COMMENT ON COLUMN student_notifications.is_broadcast IS 'If true, notification is for all students in class_id';
COMMENT ON COLUMN student_notifications.expires_at IS 'Optional expiry date for the notification';

-- Verification query
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'student_notifications';

SELECT '✅ Student notifications table created successfully!' as status;
