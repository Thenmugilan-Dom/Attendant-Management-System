-- Migration: Create security_users table
CREATE TABLE IF NOT EXISTS security_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default security user
INSERT INTO security_users (username, password, name)
VALUES ('security', 'security@123', 'Security Staff')
ON CONFLICT (username) DO NOTHING;
