-- ═══════════════════════════════════════════════════════════════════════════════════
-- MIGRATION 003: Class Timetable for Day Order Based Auto-Session Creation
-- ═══════════════════════════════════════════════════════════════════════════════════
-- 
-- PURPOSE: Store class-wise timetable per day order so sessions can be
--          auto-created based on the schedule
-- 
-- HOW TO USE: Copy and paste this entire file into Supabase SQL Editor and run it
-- 
-- ═══════════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════════
-- PART 1: PRE-REQUISITES - Ensure classes table has department column
-- ═══════════════════════════════════════════════════════════════════════════════════

-- Add department column to classes if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'classes' AND column_name = 'department'
  ) THEN
    ALTER TABLE classes ADD COLUMN department TEXT DEFAULT 'General';
    RAISE NOTICE '✅ Added department column to classes table';
  ELSE
    RAISE NOTICE '✅ Department column already exists in classes table';
  END IF;
END $$;

-- Update any NULL department values to 'General'
UPDATE classes SET department = 'General' WHERE department IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════════════
-- PART 2: CREATE CLASS_TIMETABLE TABLE
-- ═══════════════════════════════════════════════════════════════════════════════════
-- Stores which subject/teacher is assigned to which period for each day order

CREATE TABLE IF NOT EXISTS class_timetable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day_order INTEGER NOT NULL CHECK (day_order >= 1 AND day_order <= 10),
  period_number INTEGER NOT NULL CHECK (period_number >= 1 AND period_number <= 12),
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_break BOOLEAN DEFAULT FALSE,
  break_name TEXT,
  department TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(class_id, day_order, period_number)
);


-- ═══════════════════════════════════════════════════════════════════════════════════
-- PART 3: CREATE PERIOD_CONFIG TABLE
-- ═══════════════════════════════════════════════════════════════════════════════════
-- Defines the default period timings for a department

CREATE TABLE IF NOT EXISTS period_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL DEFAULT 'General',
  period_number INTEGER NOT NULL CHECK (period_number >= 1 AND period_number <= 12),
  period_name TEXT,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_break BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(department, period_number)
);


-- ═══════════════════════════════════════════════════════════════════════════════════
-- PART 4: CREATE SCHEDULED_SESSIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════════
-- Stores auto-created sessions from timetable

CREATE TABLE IF NOT EXISTS scheduled_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id UUID REFERENCES class_timetable(id) ON DELETE SET NULL,
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  day_order INTEGER NOT NULL,
  auto_created BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(timetable_id, scheduled_date)
);


-- ═══════════════════════════════════════════════════════════════════════════════════
-- PART 5: CREATE INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_timetable_class ON class_timetable(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_day_order ON class_timetable(day_order);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON class_timetable(teacher_id);
CREATE INDEX IF NOT EXISTS idx_timetable_subject ON class_timetable(subject_id);
CREATE INDEX IF NOT EXISTS idx_timetable_department ON class_timetable(department);
CREATE INDEX IF NOT EXISTS idx_period_config_department ON period_config(department);
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_date ON scheduled_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_status ON scheduled_sessions(status);


-- ═══════════════════════════════════════════════════════════════════════════════════
-- PART 6: DISABLE ROW LEVEL SECURITY (Development mode)
-- ═══════════════════════════════════════════════════════════════════════════════════

ALTER TABLE class_timetable DISABLE ROW LEVEL SECURITY;
ALTER TABLE period_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_sessions DISABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════════════════
-- PART 7: INSERT DEFAULT PERIOD CONFIGURATION (8 periods + 2 breaks)
-- ═══════════════════════════════════════════════════════════════════════════════════

INSERT INTO period_config (department, period_number, period_name, start_time, end_time, is_break)
VALUES 
  ('General', 1, 'Period 1', '09:00', '09:50', false),
  ('General', 2, 'Period 2', '09:50', '10:40', false),
  ('General', 3, 'Break', '10:40', '10:55', true),
  ('General', 4, 'Period 3', '10:55', '11:45', false),
  ('General', 5, 'Period 4', '11:45', '12:35', false),
  ('General', 6, 'Lunch', '12:35', '13:20', true),
  ('General', 7, 'Period 5', '13:20', '14:10', false),
  ('General', 8, 'Period 6', '14:10', '15:00', false),
  ('General', 9, 'Period 7', '15:00', '15:50', false),
  ('General', 10, 'Period 8', '15:50', '16:40', false)
ON CONFLICT (department, period_number) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════════════
-- PART 8: HELPER FUNCTION - Get timetable for a class on a specific day order
-- ═══════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_class_timetable(
  p_class_id UUID,
  p_day_order INTEGER
)
RETURNS TABLE(
  period_number INTEGER,
  start_time TIME,
  end_time TIME,
  subject_name TEXT,
  subject_code TEXT,
  teacher_name TEXT,
  is_break BOOLEAN,
  break_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.period_number,
    ct.start_time,
    ct.end_time,
    s.subject_name,
    s.subject_code,
    u.name as teacher_name,
    ct.is_break,
    ct.break_name
  FROM class_timetable ct
  LEFT JOIN subjects s ON ct.subject_id = s.id
  LEFT JOIN users u ON ct.teacher_id = u.id
  WHERE ct.class_id = p_class_id
    AND ct.day_order = p_day_order
  ORDER BY ct.period_number;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════════════
-- PART 9: HELPER FUNCTION - Auto-create sessions for today based on timetable
-- ═══════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_scheduled_sessions_for_today(
  p_department TEXT DEFAULT 'General'
)
RETURNS INTEGER AS $$
DECLARE
  v_day_order INTEGER;
  v_is_holiday BOOLEAN;
  v_sessions_created INTEGER := 0;
  v_timetable RECORD;
  v_session_id UUID;
  v_session_code TEXT;
BEGIN
  -- Get current day order
  SELECT day_order, is_holiday INTO v_day_order, v_is_holiday
  FROM get_current_day_order(p_department);
  
  -- Don't create sessions on holidays
  IF v_is_holiday THEN
    RETURN 0;
  END IF;
  
  -- Loop through all timetable entries for today's day order
  FOR v_timetable IN 
    SELECT ct.*, c.class_name, s.subject_name
    FROM class_timetable ct
    JOIN classes c ON ct.class_id = c.id
    LEFT JOIN subjects s ON ct.subject_id = s.id
    WHERE ct.day_order = v_day_order
      AND ct.department = p_department
      AND ct.is_break = FALSE
      AND ct.subject_id IS NOT NULL
      AND ct.teacher_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM scheduled_sessions ss
        WHERE ss.timetable_id = ct.id
          AND ss.scheduled_date = CURRENT_DATE
      )
  LOOP
    -- Generate unique session code
    v_session_code := 'AUTO-' || SUBSTRING(gen_random_uuid()::text, 1, 8);
    
    -- Create attendance session
    INSERT INTO attendance_sessions (
      teacher_id, class_id, subject_id, session_code,
      session_date, session_time, expires_at, status
    )
    VALUES (
      v_timetable.teacher_id,
      v_timetable.class_id,
      v_timetable.subject_id,
      v_session_code,
      CURRENT_DATE,
      v_timetable.start_time,
      (CURRENT_DATE + v_timetable.end_time)::TIMESTAMP WITH TIME ZONE,
      'active'
    )
    RETURNING id INTO v_session_id;
    
    -- Track in scheduled_sessions
    INSERT INTO scheduled_sessions (
      timetable_id, session_id, scheduled_date, day_order, auto_created, status
    )
    VALUES (
      v_timetable.id, v_session_id, CURRENT_DATE, v_day_order, TRUE, 'active'
    );
    
    v_sessions_created := v_sessions_created + 1;
  END LOOP;
  
  RETURN v_sessions_created;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════════════
-- PART 10: VERIFICATION - Check everything is set up correctly
-- ═══════════════════════════════════════════════════════════════════════════════════

SELECT '✅ Migration 003 Complete!' as status;

SELECT 'Tables created:' as info;
SELECT 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'class_timetable') as class_timetable,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'period_config') as period_config,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'scheduled_sessions') as scheduled_sessions;

SELECT 'Period configuration:' as info;
SELECT period_number, period_name, start_time::TEXT, end_time::TEXT, is_break 
FROM period_config 
WHERE department = 'General' 
ORDER BY period_number;

SELECT 'Classes available for timetable:' as info;
SELECT id, class_name, section, COALESCE(department, 'General') as department 
FROM classes 
ORDER BY class_name;

SELECT 'Classes by department:' as summary;
SELECT COALESCE(department, 'General') as department, COUNT(*) as class_count 
FROM classes 
GROUP BY department 
ORDER BY department;
