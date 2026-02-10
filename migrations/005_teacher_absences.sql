-- Teacher Absences and Class Transfers Table
-- Allows teachers to mark absence and assign substitutes for multiple days
-- Logged for admin tracking

CREATE TABLE IF NOT EXISTS teacher_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  absence_start_date DATE NOT NULL,
  absence_end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  absence_id UUID NOT NULL REFERENCES teacher_absences(id) ON DELETE CASCADE,
  original_teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  substitute_teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  transfer_date DATE NOT NULL,
  transfer_start_time TIME,
  transfer_end_time TIME,
  notes TEXT,
  created_by_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_teacher_absences_teacher_id ON teacher_absences(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_absences_dates ON teacher_absences(absence_start_date, absence_end_date);
CREATE INDEX IF NOT EXISTS idx_class_transfers_absence_id ON class_transfers(absence_id);
CREATE INDEX IF NOT EXISTS idx_class_transfers_teachers ON class_transfers(original_teacher_id, substitute_teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_transfers_date ON class_transfers(transfer_date);
