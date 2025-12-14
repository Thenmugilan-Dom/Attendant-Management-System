-- ═══════════════════════════════════════════════════════════════════════
-- 🎓 ATTENDANCE MANAGEMENT SYSTEM - MASTER DATABASE SETUP
-- ═══════════════════════════════════════════════════════════════════════
-- 
-- PURPOSE: Complete database schema and verification for attendance system
-- USAGE: Run this ENTIRE file in Supabase SQL Editor
-- 
-- ⚠️ IMPORTANT: This is the SINGLE SOURCE OF TRUTH for database setup
-- ⚠️ All other SQL files have been removed - use only this file
-- 
-- SECTIONS:
--   1. Database Setup & Table Creation (All 8 tables)
--   2. Indexes & Performance Optimization (Fast queries)
--   3. Triggers & Auto-Updates (Automated timestamp & counts)
--   4. Disable Row Level Security (Development mode)
--   5. Verification Queries (Check setup success)
--   6. Data Analysis & Statistics (View all data)
--   7. Troubleshooting Queries (Debug issues)
--   8. Create Default Admin User (Login: admin@kprcas.ac.in)
--   9. Quick Fixes (Optional - uncomment if needed)
-- 
-- TABLES CREATED:
--   • users (admins, teachers, students)
--   • classes (MSC A, CS B, BCA A, etc.)
--   • subjects (Java, DS, Python, etc.)
--   • teacher_subjects (connects teachers to classes & subjects)
--   • students (student records with class assignment)
--   • attendance_sessions (QR sessions created by teachers)
--   • attendance_records (student attendance marks)
--   • attendance_otps (OTP verification for login & attendance)
-- 
-- DATE CREATED: November 4, 2025
-- LAST UPDATED: November 7, 2025
-- VERSION: 3.0 - Consolidated Single File (All duplicates removed)
-- TESTED WITH: Supabase PostgreSQL 15+
-- ═══════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 1: DATABASE SETUP & TABLE CREATION
-- ═══════════════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════' as info;
SELECT '🚀 STARTING DATABASE SETUP' as info;
SELECT '═══════════════════════════════════════' as info;


-- ───────────────────────────────────────────────────────────────────────
-- 1.1 USERS TABLE (Admin, Teachers, Students)
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  plain_password TEXT,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'teacher', 'student')),
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  department TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────────
-- 1.2 CLASSES TABLE
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name TEXT NOT NULL,
  section TEXT,
  year INTEGER,
  total_students INTEGER DEFAULT 0,
  department TEXT NOT NULL DEFAULT 'General',
  created_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(class_name, section, year, department)
);


-- ───────────────────────────────────────────────────────────────────────
-- 1.3 SUBJECTS TABLE
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  credits INTEGER,
  semester INTEGER,
  department TEXT NOT NULL DEFAULT 'General',
  created_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subject_code, department)
);


-- ───────────────────────────────────────────────────────────────────────
-- 1.4 TEACHER_SUBJECTS TABLE (Critical - Connects Admin to Teachers)
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teacher_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  day_of_week TEXT CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  start_time TIME,
  end_time TIME,
  auto_session_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(teacher_id, class_id, subject_id)
);


-- ───────────────────────────────────────────────────────────────────────
-- 1.5 STUDENTS TABLE
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  address TEXT,
  parent_phone TEXT,
  parent_name TEXT,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  department TEXT NOT NULL DEFAULT 'General',
  created_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────────
-- 1.6 ATTENDANCE_SESSIONS TABLE
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  session_code TEXT NOT NULL UNIQUE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_time TIME NOT NULL DEFAULT CURRENT_TIME,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────────
-- 1.7 ATTENDANCE_RECORDS TABLE
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late', 'on_duty')),
  marked_at TIMESTAMP WITH TIME ZONE,
  marked_by TEXT,
  otp_verified BOOLEAN DEFAULT FALSE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);


-- ───────────────────────────────────────────────────────────────────────
-- 1.8 OTPS TABLE (For OTP storage and verification)
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────────
-- 1.9 ATTENDANCE_OTPS TABLE (Legacy - for backward compatibility)
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  verified BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────────
-- 1.10 OD_REQUESTS TABLE (On Duty Requests)
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS od_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  od_start_date DATE NOT NULL,
  od_end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  teacher_approved BOOLEAN DEFAULT FALSE,
  teacher_approved_at TIMESTAMP WITH TIME ZONE,
  teacher_approval_notes TEXT,
  admin_approved BOOLEAN DEFAULT FALSE,
  admin_approved_at TIMESTAMP WITH TIME ZONE,
  admin_approval_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 2: INDEXES & PERFORMANCE OPTIMIZATION
-- ═══════════════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════' as info;
SELECT '⚡ CREATING INDEXES' as info;
SELECT '═══════════════════════════════════════' as info;


-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Classes indexes
CREATE INDEX IF NOT EXISTS idx_classes_name ON classes(class_name);
CREATE INDEX IF NOT EXISTS idx_classes_section ON classes(section);

-- Subjects indexes
CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(subject_code);
CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(subject_name);

-- Teacher_subjects indexes (CRITICAL FOR ADMIN-TEACHER CONNECTION)
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher ON teacher_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_class ON teacher_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_subject ON teacher_subjects(subject_id);

-- Students indexes
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

-- Attendance_sessions indexes
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_teacher ON attendance_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class ON attendance_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_subject ON attendance_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_code ON attendance_sessions(session_code);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_status ON attendance_sessions(status);

-- Attendance_records indexes
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records(status);

-- Attendance_otps indexes
CREATE INDEX IF NOT EXISTS idx_attendance_otps_email ON attendance_otps(email);
CREATE INDEX IF NOT EXISTS idx_attendance_otps_session ON attendance_otps(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_otps_verified ON attendance_otps(verified);

-- OTPs indexes (general OTP table)
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_otps_is_used ON otps(is_used);

-- OD_requests indexes
CREATE INDEX IF NOT EXISTS idx_od_requests_student ON od_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_od_requests_teacher ON od_requests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_od_requests_admin ON od_requests(admin_id);
CREATE INDEX IF NOT EXISTS idx_od_requests_class ON od_requests(class_id);
CREATE INDEX IF NOT EXISTS idx_od_requests_subject ON od_requests(subject_id);
CREATE INDEX IF NOT EXISTS idx_od_requests_status ON od_requests(status);
CREATE INDEX IF NOT EXISTS idx_od_requests_start_date ON od_requests(od_start_date);
CREATE INDEX IF NOT EXISTS idx_od_requests_end_date ON od_requests(od_end_date);
CREATE INDEX IF NOT EXISTS idx_od_requests_teacher_approved ON od_requests(teacher_approved);
CREATE INDEX IF NOT EXISTS idx_od_requests_admin_approved ON od_requests(admin_approved);


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 3: TRIGGERS & AUTO-UPDATES
-- ═══════════════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════' as info;
SELECT '🔄 CREATING TRIGGERS' as info;
SELECT '═══════════════════════════════════════' as info;


-- ───────────────────────────────────────────────────────────────────────
-- 3.1 Auto-update updated_at timestamp
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to classes
DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
CREATE TRIGGER update_classes_updated_at
    BEFORE UPDATE ON classes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to subjects
DROP TRIGGER IF EXISTS update_subjects_updated_at ON subjects;
CREATE TRIGGER update_subjects_updated_at
    BEFORE UPDATE ON subjects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to students
DROP TRIGGER IF EXISTS update_students_updated_at ON students;
CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to attendance_records
DROP TRIGGER IF EXISTS update_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER update_attendance_records_updated_at
    BEFORE UPDATE ON attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ───────────────────────────────────────────────────────────────────────
-- 3.2 Auto-update class student count
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_class_student_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE classes 
        SET total_students = total_students + 1 
        WHERE id = NEW.class_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE classes 
        SET total_students = total_students - 1 
        WHERE id = OLD.class_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.class_id != NEW.class_id THEN
            UPDATE classes 
            SET total_students = total_students - 1 
            WHERE id = OLD.class_id;
            UPDATE classes 
            SET total_students = total_students + 1 
            WHERE id = NEW.class_id;
        END IF;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_count_trigger ON students;
CREATE TRIGGER student_count_trigger
    AFTER INSERT OR DELETE OR UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_class_student_count();


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 4: DISABLE ROW LEVEL SECURITY (Development Mode)
-- ═══════════════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════' as info;
SELECT '🔓 DISABLING ROW LEVEL SECURITY' as info;
SELECT '═══════════════════════════════════════' as info;

-- Disable RLS on all tables (using service role for security)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_otps DISABLE ROW LEVEL SECURITY;
ALTER TABLE otps DISABLE ROW LEVEL SECURITY;
ALTER TABLE od_requests DISABLE ROW LEVEL SECURITY;

SELECT '✅ RLS DISABLED ON ALL TABLES' as info;
SELECT 'Using service role for API security instead' as info;


SELECT '✅ ROW LEVEL SECURITY DISABLED' as info;
SELECT '✅ USING SERVICE ROLE FOR API SECURITY' as info;
SELECT '✅ All tables accessible for service role operations' as info;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 5: VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════' as info;
SELECT '✅ DATABASE SETUP COMPLETE' as info;
SELECT '═══════════════════════════════════════' as info;


-- ───────────────────────────────────────────────────────────────────────
-- 5.1 Verify All Tables Created
-- ───────────────────────────────────────────────────────────────────────

SELECT '📋 ALL TABLES:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'users', 
  'classes', 
  'subjects', 
  'teacher_subjects', 
  'students', 
  'attendance_sessions', 
  'attendance_records', 
  'attendance_otps',
  'otps'
)
ORDER BY table_name;


-- ───────────────────────────────────────────────────────────────────────
-- 5.2 Verify teacher_subjects Table Structure
-- ───────────────────────────────────────────────────────────────────────

SELECT '📊 TEACHER_SUBJECTS TABLE STRUCTURE:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'teacher_subjects'
ORDER BY ordinal_position;


-- ───────────────────────────────────────────────────────────────────────
-- 5.3 Current Data Counts
-- ───────────────────────────────────────────────────────────────────────

SELECT '📈 CURRENT DATA COUNTS:' as info;
SELECT 
  (SELECT COUNT(*) FROM users WHERE user_type = 'admin') as total_admins,
  (SELECT COUNT(*) FROM users WHERE user_type = 'teacher') as total_teachers,
  (SELECT COUNT(*) FROM classes) as total_classes,
  (SELECT COUNT(*) FROM subjects) as total_subjects,
  (SELECT COUNT(*) FROM teacher_subjects) as total_assignments,
  (SELECT COUNT(*) FROM students) as total_students,
  (SELECT COUNT(*) FROM attendance_sessions) as total_sessions,
  (SELECT COUNT(*) FROM attendance_records) as total_attendance_records;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 6: DATA ANALYSIS & STATISTICS
-- ═══════════════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════' as info;
SELECT '📊 SYSTEM ANALYSIS & STATISTICS' as info;
SELECT '═══════════════════════════════════════' as info;


-- ───────────────────────────────────────────────────────────────────────
-- 6.1 All Teachers with Their Assignments
-- ───────────────────────────────────────────────────────────────────────

SELECT '👥 ALL TEACHERS WITH ASSIGNMENTS:' as info;
SELECT 
  u.id,
  u.name,
  u.email,
  u.department,
  u.status,
  COUNT(ts.id) as total_assignments,
  STRING_AGG(DISTINCT c.class_name || ' ' || COALESCE(c.section, ''), ', ' ORDER BY c.class_name || ' ' || COALESCE(c.section, '')) as assigned_classes,
  STRING_AGG(DISTINCT s.subject_name, ', ' ORDER BY s.subject_name) as assigned_subjects
FROM users u
LEFT JOIN teacher_subjects ts ON ts.teacher_id = u.id
LEFT JOIN classes c ON c.id = ts.class_id
LEFT JOIN subjects s ON s.id = ts.subject_id
WHERE u.user_type = 'teacher'
GROUP BY u.id, u.name, u.email, u.department, u.status
ORDER BY u.name;


-- ───────────────────────────────────────────────────────────────────────
-- 6.2 Detailed Teacher Assignments
-- ───────────────────────────────────────────────────────────────────────

SELECT '📚 DETAILED TEACHER ASSIGNMENTS:' as info;
SELECT 
  u.name as teacher_name,
  u.email as teacher_email,
  u.department,
  c.class_name || ' ' || COALESCE(c.section, '') as class_full,
  c.year as class_year,
  s.subject_code,
  s.subject_name,
  s.credits,
  s.semester,
  ts.created_at as assigned_date
FROM teacher_subjects ts
JOIN users u ON u.id = ts.teacher_id
JOIN classes c ON c.id = ts.class_id
JOIN subjects s ON s.id = ts.subject_id
ORDER BY u.name, c.class_name, s.subject_name;


-- ───────────────────────────────────────────────────────────────────────
-- 6.3 Teachers Without Assignments
-- ───────────────────────────────────────────────────────────────────────

SELECT '⚠️ TEACHERS WITHOUT ASSIGNMENTS:' as info;
SELECT 
  u.id,
  u.name,
  u.email,
  u.department,
  u.status,
  u.created_at
FROM users u
LEFT JOIN teacher_subjects ts ON ts.teacher_id = u.id
WHERE u.user_type = 'teacher'
AND ts.id IS NULL
ORDER BY u.name;


-- ───────────────────────────────────────────────────────────────────────
-- 6.4 Classes with Assigned Teachers
-- ───────────────────────────────────────────────────────────────────────

SELECT '🏫 CLASSES WITH ASSIGNED TEACHERS:' as info;
SELECT 
  c.class_name || ' ' || COALESCE(c.section, '') as class_full,
  c.year,
  c.total_students,
  COUNT(DISTINCT ts.teacher_id) as teacher_count,
  STRING_AGG(DISTINCT u.name, ', ' ORDER BY u.name) as teachers,
  STRING_AGG(DISTINCT s.subject_name, ', ' ORDER BY s.subject_name) as subjects
FROM classes c
LEFT JOIN teacher_subjects ts ON ts.class_id = c.id
LEFT JOIN users u ON u.id = ts.teacher_id
LEFT JOIN subjects s ON s.id = ts.subject_id
GROUP BY c.id, c.class_name, c.section, c.year, c.total_students
ORDER BY c.class_name, c.section;


-- ───────────────────────────────────────────────────────────────────────
-- 6.5 Subjects with Assigned Teachers
-- ───────────────────────────────────────────────────────────────────────

SELECT '📖 SUBJECTS WITH ASSIGNED TEACHERS:' as info;
SELECT 
  s.subject_code,
  s.subject_name,
  s.credits,
  s.semester,
  COUNT(DISTINCT ts.teacher_id) as teacher_count,
  STRING_AGG(DISTINCT u.name, ', ' ORDER BY u.name) as teachers,
  STRING_AGG(DISTINCT c.class_name || ' ' || COALESCE(c.section, ''), ', ' ORDER BY c.class_name || ' ' || COALESCE(c.section, '')) as classes
FROM subjects s
LEFT JOIN teacher_subjects ts ON ts.subject_id = s.id
LEFT JOIN users u ON u.id = ts.teacher_id
LEFT JOIN classes c ON c.id = ts.class_id
GROUP BY s.id, s.subject_code, s.subject_name, s.credits, s.semester
ORDER BY s.subject_name;


-- ───────────────────────────────────────────────────────────────────────
-- 6.6 Unassigned Resources
-- ───────────────────────────────────────────────────────────────────────

SELECT '📋 UNASSIGNED RESOURCES:' as info;

-- Classes without any teacher
SELECT 'Classes without Teachers' as type, class_name || ' ' || COALESCE(section, '') as name
FROM classes c
LEFT JOIN teacher_subjects ts ON ts.class_id = c.id
WHERE ts.id IS NULL

UNION ALL

-- Subjects not assigned to any teacher
SELECT 'Subjects without Teachers' as type, subject_name as name
FROM subjects s
LEFT JOIN teacher_subjects ts ON ts.subject_id = s.id
WHERE ts.id IS NULL

ORDER BY type, name;


-- ───────────────────────────────────────────────────────────────────────
-- 6.7 Check for Duplicate Assignments
-- ───────────────────────────────────────────────────────────────────────

SELECT '🔍 DUPLICATE ASSIGNMENTS CHECK:' as info;
SELECT 
  u.name as teacher_name,
  c.class_name || ' ' || COALESCE(c.section, '') as class_full,
  s.subject_name,
  COUNT(*) as duplicate_count
FROM teacher_subjects ts
JOIN users u ON u.id = ts.teacher_id
JOIN classes c ON c.id = ts.class_id
JOIN subjects s ON s.id = ts.subject_id
GROUP BY u.name, c.class_name, c.section, s.subject_name
HAVING COUNT(*) > 1;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 7: TROUBLESHOOTING QUERIES
-- ═══════════════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════' as info;
SELECT '🔧 TROUBLESHOOTING INFORMATION' as info;
SELECT '═══════════════════════════════════════' as info;


-- ───────────────────────────────────────────────────────────────────────
-- 7.1 Check All Indexes
-- ───────────────────────────────────────────────────────────────────────

SELECT '📑 ALL INDEXES:' as info;
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('users', 'classes', 'subjects', 'teacher_subjects', 'students', 
                  'attendance_sessions', 'attendance_records', 'attendance_otps', 'otps')
ORDER BY tablename, indexname;


-- ───────────────────────────────────────────────────────────────────────
-- 7.2 Check All Triggers
-- ───────────────────────────────────────────────────────────────────────

SELECT '⚡ ALL TRIGGERS:' as info;
SELECT 
    trigger_name,
    event_object_table as table_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;


-- ───────────────────────────────────────────────────────────────────────
-- 7.3 Check Foreign Key Constraints
-- ───────────────────────────────────────────────────────────────────────

SELECT '🔗 FOREIGN KEY CONSTRAINTS:' as info;
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 8: CREATE DEPARTMENT-BASED ADMIN USERS
-- ═══════════════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════════════════════════════════════' as info;
SELECT '👤 CREATING DEPARTMENT-BASED ADMIN USERS' as info;
SELECT '═══════════════════════════════════════════════════════════════════════' as info;
SELECT '' as info;
SELECT '⚠️ IMPORTANT: Each admin manages ONLY their assigned department' as info;
SELECT '   - Computer Science Admin sees only CS classes/students/teachers' as info;
SELECT '   - IT Admin sees only IT classes/students/teachers' as info;
SELECT '   - Other Department Admin sees only their department resources' as info;
SELECT '' as info;


-- ───────────────────────────────────────────────────────────────────────
-- 8.1 Computer Science Department Admin
-- ───────────────────────────────────────────────────────────────────────

INSERT INTO users (
  email,
  name,
  username,
  plain_password,
  user_type,
  role,
  department,
  phone,
  status
) VALUES (
  'cs-admin@kprcas.ac.in',
  'Computer Science Admin',
  'cs_admin',
  'CS@Admin123',
  'admin',
  'admin',
  'Computer Science',
  '+91-9000000001',
  'active'
) 
ON CONFLICT (email) 
DO UPDATE SET 
  plain_password = 'CS@Admin123',
  user_type = 'admin',
  role = 'admin',
  department = 'Computer Science',
  status = 'active',
  updated_at = NOW()
RETURNING email, name, department, plain_password;

SELECT '✅ Computer Science Admin Created' as status;
SELECT '   Email: cs-admin@kprcas.ac.in | Department: Computer Science' as details;
SELECT '' as spacer;


-- ───────────────────────────────────────────────────────────────────────
-- 8.2 Information Technology Department Admin
-- ───────────────────────────────────────────────────────────────────────

INSERT INTO users (
  email,
  name,
  username,
  plain_password,
  user_type,
  role,
  department,
  phone,
  status
) VALUES (
  'it-admin@kprcas.ac.in',
  'Information Technology Admin',
  'it_admin',
  'IT@Admin123',
  'admin',
  'admin',
  'Information Technology',
  '+91-9000000002',
  'active'
) 
ON CONFLICT (email) 
DO UPDATE SET 
  plain_password = 'IT@Admin123',
  user_type = 'admin',
  role = 'admin',
  department = 'Information Technology',
  status = 'active',
  updated_at = NOW()
RETURNING email, name, department, plain_password;

SELECT '✅ IT Admin Created' as status;
SELECT '   Email: it-admin@kprcas.ac.in | Department: Information Technology' as details;
SELECT '' as spacer;


-- ───────────────────────────────────────────────────────────────────────
-- 8.3 Master of Science Admin
-- ───────────────────────────────────────────────────────────────────────

INSERT INTO users (
  email,
  name,
  username,
  plain_password,
  user_type,
  role,
  department,
  phone,
  status
) VALUES (
  'msc-admin@kprcas.ac.in',
  'Master of Science Admin',
  'msc_admin',
  'MSC@Admin123',
  'admin',
  'admin',
  'Master of Science',
  '+91-9000000003',
  'active'
) 
ON CONFLICT (email) 
DO UPDATE SET 
  plain_password = 'MSC@Admin123',
  user_type = 'admin',
  role = 'admin',
  department = 'Master of Science',
  status = 'active',
  updated_at = NOW()
RETURNING email, name, department, plain_password;

SELECT '✅ MSC Admin Created' as status;
SELECT '   Email: msc-admin@kprcas.ac.in | Department: Master of Science' as details;
SELECT '' as spacer;


-- ───────────────────────────────────────────────────────────────────────
-- 8.4 Bachelor of Computer Applications Admin
-- ───────────────────────────────────────────────────────────────────────

INSERT INTO users (
  email,
  name,
  username,
  plain_password,
  user_type,
  role,
  department,
  phone,
  status
) VALUES (
  'bca-admin@kprcas.ac.in',
  'Bachelor of Computer Applications Admin',
  'bca_admin',
  'BCA@Admin123',
  'admin',
  'admin',
  'Bachelor of Computer Applications',
  '+91-9000000004',
  'active'
) 
ON CONFLICT (email) 
DO UPDATE SET 
  plain_password = 'BCA@Admin123',
  user_type = 'admin',
  role = 'admin',
  department = 'Bachelor of Computer Applications',
  status = 'active',
  updated_at = NOW()
RETURNING email, name, department, plain_password;

SELECT '✅ BCA Admin Created' as status;
SELECT '   Email: bca-admin@kprcas.ac.in | Department: Bachelor of Computer Applications' as details;
SELECT '' as spacer;


-- ───────────────────────────────────────────────────────────────────────
-- 8.5 System/Super Admin (Optional - can see all departments)
-- ───────────────────────────────────────────────────────────────────────

INSERT INTO users (
  email,
  name,
  username,
  plain_password,
  user_type,
  role,
  department,
  phone,
  status
) VALUES (
  'admin@kprcas.ac.in',
  'System Administrator',
  'admin',
  'Admin@123',
  'admin',
  'admin',
  'Administration',
  '+91-9000000000',
  'active'
) 
ON CONFLICT (email) 
DO UPDATE SET 
  plain_password = 'Admin@123',
  user_type = 'admin',
  role = 'admin',
  department = 'Administration',
  status = 'active',
  updated_at = NOW()
RETURNING email, name, department, plain_password;

SELECT '✅ System Admin Created' as status;
SELECT '   Email: admin@kprcas.ac.in | Department: Administration' as details;
SELECT '' as spacer;


-- ───────────────────────────────────────────────────────────────────────
-- 8.6 Verify All Admin Users Created
-- ───────────────────────────────────────────────────────────────────────

SELECT '═══════════════════════════════════════════════════════════════════════' as info;
SELECT '✅ ALL ADMIN USERS CREATED - DEPARTMENT ISOLATION ACTIVE' as info;
SELECT '═══════════════════════════════════════════════════════════════════════' as info;
SELECT '' as info;

SELECT 
  email,
  name,
  username,
  plain_password,
  department,
  status,
  created_at
FROM users 
WHERE user_type = 'admin'
ORDER BY department, email;

SELECT '' as info;
SELECT '📋 ADMIN ACCESS LEVELS:' as info;
SELECT '   • Computer Science Admin → Manages CS department only' as info;
SELECT '   • IT Admin → Manages IT department only' as info;
SELECT '   • MSC Admin → Manages Master of Science department only' as info;
SELECT '   • BCA Admin → Manages BCA department only' as info;
SELECT '   • System Admin → Full system access (Administration)' as info;
SELECT '' as info;


SELECT '═══════════════════════════════════════════════════════════════════════' as info;
SELECT '🔐 ADMIN LOGIN CREDENTIALS (Department-Based)' as info;
SELECT '═══════════════════════════════════════════════════════════════════════' as info;
SELECT '' as info;

SELECT '📌 COMPUTER SCIENCE DEPARTMENT:' as credential_header;
SELECT '   Email: cs-admin@kprcas.ac.in' as credential;
SELECT '   Password: CS@Admin123 (for reference)' as credential;
SELECT '   Department: Computer Science' as credential;
SELECT '   Access: CS classes, subjects, students, teachers only' as credential;
SELECT '' as spacer;

SELECT '📌 INFORMATION TECHNOLOGY DEPARTMENT:' as credential_header;
SELECT '   Email: it-admin@kprcas.ac.in' as credential;
SELECT '   Password: IT@Admin123 (for reference)' as credential;
SELECT '   Department: Information Technology' as credential;
SELECT '   Access: IT classes, subjects, students, teachers only' as credential;
SELECT '' as spacer;

SELECT '📌 MASTER OF SCIENCE DEPARTMENT:' as credential_header;
SELECT '   Email: msc-admin@kprcas.ac.in' as credential;
SELECT '   Password: MSC@Admin123 (for reference)' as credential;
SELECT '   Department: Master of Science' as credential;
SELECT '   Access: MSC classes, subjects, students, teachers only' as credential;
SELECT '' as spacer;

SELECT '📌 BACHELOR OF COMPUTER APPLICATIONS DEPARTMENT:' as credential_header;
SELECT '   Email: bca-admin@kprcas.ac.in' as credential;
SELECT '   Password: BCA@Admin123 (for reference)' as credential;
SELECT '   Department: Bachelor of Computer Applications' as credential;
SELECT '   Access: BCA classes, subjects, students, teachers only' as credential;
SELECT '' as spacer;

SELECT '📌 SYSTEM ADMINISTRATOR:' as credential_header;
SELECT '   Email: admin@kprcas.ac.in' as credential;
SELECT '   Password: Admin@123 (for reference)' as credential;
SELECT '   Department: Administration' as credential;
SELECT '   Access: Full system access (future: all departments)' as credential;
SELECT '' as spacer;

SELECT '═══════════════════════════════════════════════════════════════════════' as info;
SELECT '⚠️ KEY POINTS:' as info;
SELECT '═══════════════════════════════════════════════════════════════════════' as info;
SELECT '   ✅ Each admin manages ONLY their department' as point;
SELECT '   ✅ System uses OTP login (passwords for reference only)' as point;
SELECT '   ✅ Department isolation is automatic & enforced at API level' as point;
SELECT '   ✅ CS admin CANNOT see IT classes, teachers, or students' as point;
SELECT '   ✅ IT admin CANNOT see CS classes, teachers, or students' as point;
SELECT '   ✅ Each department has complete isolation' as point;
SELECT '' as info;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 9: QUICK FIXES (Uncomment if needed)
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 9.1 Fix: Add schedule fields to teacher_subjects for auto-sessions
-- ───────────────────────────────────────────────────────────────────────

-- Run these if you have an existing database without schedule fields:
/*
ALTER TABLE teacher_subjects 
  ADD COLUMN IF NOT EXISTS day_of_week TEXT CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'));

ALTER TABLE teacher_subjects 
  ADD COLUMN IF NOT EXISTS start_time TIME;

ALTER TABLE teacher_subjects 
  ADD COLUMN IF NOT EXISTS end_time TIME;

ALTER TABLE teacher_subjects 
  ADD COLUMN IF NOT EXISTS auto_session_enabled BOOLEAN DEFAULT false;
*/


-- ───────────────────────────────────────────────────────────────────────
-- 9.2 Fix: Add total_students column if missing
-- ───────────────────────────────────────────────────────────────────────

-- Uncomment these lines if you need to add total_students column:
/*
ALTER TABLE classes ADD COLUMN IF NOT EXISTS total_students INTEGER DEFAULT 0;

UPDATE classes 
SET total_students = (
    SELECT COUNT(*) 
    FROM students 
    WHERE students.class_id = classes.id
);
*/


-- ───────────────────────────────────────────────────────────────────────
-- 9.3 Fix: Reset RLS if needed
-- ───────────────────────────────────────────────────────────────────────

-- Already disabled above, but uncomment if you need to reset:
/*
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_otps DISABLE ROW LEVEL SECURITY;
*/


-- ───────────────────────────────────────────────────────────────────────
-- 9.4 Create Additional Admin Users (if needed)
-- ───────────────────────────────────────────────────────────────────────

-- Uncomment to create more admin accounts:
/*
INSERT INTO users (email, name, username, user_type, role, department, status) VALUES
  ('principal@kprcas.ac.in', 'Principal', 'principal', 'admin', 'admin', 'Administration', 'active'),
  ('hod.cs@kprcas.ac.in', 'HOD Computer Science', 'hod_cs', 'admin', 'admin', 'CS Department', 'active')
ON CONFLICT (email) DO NOTHING;
*/


-- ═══════════════════════════════════════════════════════════════════════
-- COMPLETION
-- ═══════════════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════' as info;
SELECT '🎉 DATABASE SETUP COMPLETE!' as info;
SELECT '═══════════════════════════════════════' as info;

SELECT 
  '✅ All tables created' as status,
  '✅ All indexes created' as status,
  '✅ All triggers created' as status,
  '✅ RLS disabled' as status,
  '✅ Ready to use!' as status;

SELECT 'Setup completed at: ' || NOW()::TEXT as timestamp;


-- ═══════════════════════════════════════════════════════════════════════
-- 🔐 CREATE ADMIN USER
-- ═══════════════════════════════════════════════════════════════════════
-- 
-- Email: admin@kprcas.ac.in
-- Password: admin@123 (stored in plain_password field for reference only)
-- 
-- RUN THIS IN: Supabase SQL Editor
-- COPY AND PASTE THE ENTIRE CONTENT BELOW
-- 
-- ═══════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────
-- STEP 1: Create Admin User
-- ───────────────────────────────────────────────────────────────────────

SELECT '➕ CREATING ADMIN USER...' as info;

INSERT INTO users (
  email,
  name,
  username,
  plain_password,
  user_type,
  role,
  department,
  phone,
  status
) VALUES (
  'admin@kprcas.ac.in',
  'System Administrator',
  'admin',
  'admin@123',
  'admin',
  'admin',
  'Administration',
  NULL,
  'active'
) 
ON CONFLICT (email) 
DO UPDATE SET 
  plain_password = 'admin@123',
  user_type = 'admin',
  role = 'admin',
  status = 'active',
  updated_at = NOW()
RETURNING id, email, name, user_type, role, plain_password;


-- ───────────────────────────────────────────────────────────────────────
-- STEP 2: Verify Admin User Created
-- ───────────────────────────────────────────────────────────────────────

SELECT '✅ VERIFICATION - ADMIN USER DETAILS:' as info;

SELECT 
  id,
  email,
  name,
  username,
  plain_password,
  user_type,
  role,
  department,
  status,
  created_at
FROM users 
WHERE email = 'admin@kprcas.ac.in';


-- ───────────────────────────────────────────────────────────────────────
-- STEP 3: Check All Admin Users
-- ───────────────────────────────────────────────────────────────────────

SELECT '👥 ALL ADMIN USERS IN SYSTEM:' as info;

SELECT 
  email,
  name,
  username,
  plain_password,
  status
FROM users 
WHERE user_type = 'admin' 
ORDER BY created_at;


-- ═══════════════════════════════════════════════════════════════════════
-- ✅ ADMIN USER CREATED SUCCESSFULLY!
-- ═══════════════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════' as info;
SELECT '🎉 ADMIN USER READY!' as info;
SELECT '═══════════════════════════════════════' as info;


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



-- ═══════════════════════════════════════════════════════════════════════
-- 🚀 HOW TO LOGIN
-- ═══════════════════════════════════════════════════════════════════════

/*

STEP 1: Go to Login Page
  → http://localhost:3000/login

STEP 2: Select "Admin" Tab

STEP 3: Enter Email
  → admin@kprcas.ac.in

STEP 4: Click "Send OTP"
  → OTP will be sent to cnp3301@gmail.com
  → (This is configured in .env.local as GMAIL_USER)

STEP 5: Check Email
  → FROM: "KPRCAS Attendance" <cnp3301@gmail.com>
  → TO: admin@kprcas.ac.in (forwarded to cnp3301@gmail.com)
  → SUBJECT: Your KPRCAS Attendance OTP
  → Copy the 6-digit OTP code

STEP 6: Enter OTP
  → Paste or type the 6-digit code
  → Click "Verify & Login"

STEP 7: Access Admin Dashboard
  → You'll be redirected to /admin
  → Full admin access unlocked! 🎯

═══════════════════════════════════════════════════════════════════════

📋 ADMIN CREDENTIALS SUMMARY:

Email:    admin@kprcas.ac.in
Password: admin@123 (for reference only, not used for login)
Login:    OTP-based (password field is just for your reference)

Note: The system uses OTP authentication, not password login.
      The password field is stored for your reference only.

═══════════════════════════════════════════════════════════════════════

🎓 WHAT YOU CAN DO AS ADMIN:

✅ View System Statistics
   - Total students, teachers, classes
   - Daily attendance rates
   - Recent activity

✅ Manage Users
   - Create/Edit/Delete admins, teachers, students
   - Bulk import students via Excel

✅ Manage Classes
   - Add classes (MSC A, CS B, BCA A, etc.)
   - Edit class details (section, year)
   - Delete unused classes

✅ Manage Subjects
   - Add subjects (Java, DS, Python, etc.)
   - Set subject codes, credits, semesters
   - Delete unused subjects

✅ Assign Teachers
   - Connect teachers to classes
   - Assign subjects to teachers
   - Manage teaching assignments
   - Set class schedules (day/time)
   - Enable auto-session creation with email notifications

✅ View Reports
   - Attendance statistics
   - Class-wise reports
   - Teacher-wise reports
   - Export to PDF/Excel

═══════════════════════════════════════════════════════════════════════

*/

-- ═══════════════════════════════════════════════════════════════════════
-- NEXT STEPS
-- ═══════════════════════════════════════════════════════════════════════
/*

🔐 ADMIN LOGIN:
   Email:    admin@kprcas.ac.in
   Password: admin@123
   
   Steps to login:
   1. Go to http://localhost:3000/login
   2. Enter email: admin@kprcas.ac.in
   3. Enter password: admin@123
   4. Click "Login"
   5. Admin Dashboard opens!

🔐 TEACHER LOGIN:
   Email:    (created by admin)
   Password: (shown in admin panel after creation)
   
   Steps to create teacher:
   1. Login as admin
   2. Go to Admin → Manage → Teachers tab
   3. Click "Add Teacher" button
   4. Fill in teacher details (email, name, department, phone)
   5. Click "Create Teacher"
   6. PASSWORD IS AUTO-GENERATED AND SHOWN
   7. Copy the password and give it to the teacher
   8. Teacher can then login at http://localhost:3000/login
   
   Note: System uses PASSWORD-BASED LOGIN (not OTP)

───────────────────────────────────────────────────────────────────────

📋 SETUP CHECKLIST:

1. ✅ DATABASE SETUP (Just completed by running this file)
   - All tables created
   - All indexes created
   - All triggers created
   - Admin user created

2. LOGIN AS ADMIN
   - Use credentials above
   - Access admin dashboard

3. CREATE CLASSES & SUBJECTS:
   - Go to Admin → Manage → Classes tab
   - Add your classes (MSC A, CS B, BCA A, etc.)
   - Go to Admin → Manage → Subjects tab
   - Add subjects (Java, DS, Python, etc.)

4. CREATE TEACHER ACCOUNTS:
   - Go to Admin → Manage → Create User
   - Add teacher accounts
   - Set email, name, department

5. ⚠️ ASSIGN TEACHERS TO CLASSES (CRITICAL):
   - Go to Admin → Manage → Assignments tab
   - Select teacher, class, and subject
   - OPTIONAL: Enable automatic session scheduling
     * Check "Enable automatic session creation"
     * Select day of week (Monday-Sunday)
     * Set start time and end time
     * Sessions will auto-create 5 minutes before class time
     * QR code and session code will be emailed to teacher
   - Click "Assign"
   - Without this, teachers won't see any classes in their dashboard!

6. ADD STUDENTS:
   - Go to Admin → Manage → Students tab
   - Import Excel file or add manually
   - Ensure students are assigned to classes

7. TEST TEACHER DASHBOARD:
   - Login as teacher
   - Should see assigned classes in featured section
   - Generate QR codes for attendance
   - Monitor active sessions

8. TEST STUDENT ATTENDANCE:
   - Go to /students page
   - Scan teacher's QR code
   - Enter email and verify OTP
   - Attendance marked!

9. GENERATE REPORTS:
   - Teacher dashboard → Reports
   - View statistics and analytics
   - Export to PDF/Excel

═══════════════════════════════════════════════════════════════════════

🎯 IMPORTANT NOTES:

- System uses OTP-based authentication (not password login)
- OTPs are sent via email (configured in .env.local)
- OTPs expire in 2 minutes
- Admin password field is for reference only
- Teachers MUST be assigned to classes to see them in dashboard
- The teacher_subjects table is critical for teacher-class connections
- Auto-session feature requires Vercel Cron or external cron service
- Cron job runs every 3 minutes to check for scheduled sessions
- Sessions auto-create 5 minutes before class start time
- QR codes and session codes are emailed to teachers automatically

═══════════════════════════════════════════════════════════════════════

📧 EMAIL CONFIGURATION:

Make sure .env.local has:
  GMAIL_USER=your_email@gmail.com
  GMAIL_APP_PASSWORD=your_16_digit_app_password
  CRON_SECRET=your-secret-key-here (for cron job security)
  NEXT_PUBLIC_APP_URL=https://your-domain.com (for email links)

Get app password from: https://myaccount.google.com/apppasswords

═══════════════════════════════════════════════════════════════════════

⏰ CRON JOB SETUP (For Auto-Sessions):

The system includes automatic session creation. To enable it:

1. On Vercel (Automatic):
   - The vercel.json file is already configured
   - Cron runs every 3 minutes automatically
   - No additional setup needed

2. On Other Platforms:
   - Set up a cron job to call: /api/cron/create-scheduled-sessions
   - Run every 3 minutes: * / 3 * * * * (remove spaces)
   - Include Authorization header: Bearer YOUR_CRON_SECRET
   - Example cURL:
     curl -H "Authorization: Bearer your-secret-key" \
          https://your-domain.com/api/cron/create-scheduled-sessions

3. Test the Cron Job:
   - Visit /api/cron/create-scheduled-sessions in your browser
   - Check response for scheduled sessions
   - Verify emails are being sent to teachers

═══════════════════════════════════════════════════════════════════════
*/

