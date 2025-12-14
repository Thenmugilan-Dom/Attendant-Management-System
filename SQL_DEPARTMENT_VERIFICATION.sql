-- Department-Based Admin Isolation - Database Verification & Setup

-- 1. Verify department column exists in students table
-- This column was added to MASTER_DATABASE_SETUP.sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'students' AND column_name = 'department';

-- 2. Verify department column exists in classes table
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'classes' AND column_name = 'department';

-- 3. Verify department column exists in subjects table
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'subjects' AND column_name = 'department';

-- 4. Verify department column exists in users table (for admins)
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'department';

-- 5. Check existing admins and their departments
SELECT id, email, role, department FROM users WHERE role = 'admin';

-- 6. If you need to set department for existing admins:
-- UPDATE users SET department = 'Computer Science' WHERE email = 'cs-admin@kprcas.ac.in';
-- UPDATE users SET department = 'Information Technology' WHERE email = 'it-admin@kprcas.ac.in';

-- 7. Verify unique constraints include department:
-- For classes: UNIQUE(class_name, section, year, department)
-- For subjects: UNIQUE(subject_code, department)

-- 8. Test department isolation:
-- Run as CS admin:
SELECT * FROM classes WHERE department = 'Computer Science';

-- Run as IT admin:
SELECT * FROM classes WHERE department = 'Information Technology';

-- 9. Verify students are assigned to correct department:
SELECT id, name, email, department FROM students WHERE department = 'Computer Science' LIMIT 5;

-- 10. Verify subjects are assigned to correct department:
SELECT id, subject_code, subject_name, department FROM subjects WHERE department = 'Computer Science' LIMIT 5;
