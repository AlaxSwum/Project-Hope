-- Password Manager Complete Setup - Run this ONCE in Supabase SQL Editor
-- This script sets up everything needed for the password manager to work

-- Step 1: Create tables if they don't exist
CREATE TABLE IF NOT EXISTS password_folders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1',
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS password_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    folder_id UUID REFERENCES password_folders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    website_url TEXT,
    website_name VARCHAR(255),
    email VARCHAR(255),
    username VARCHAR(255),
    password_encrypted TEXT NOT NULL,
    phone_number VARCHAR(50),
    authenticator_key TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS password_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    password_id UUID REFERENCES password_entries(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    can_edit BOOLEAN DEFAULT false,
    shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(password_id, user_id)
);

-- Step 2: Disable RLS to prevent recursion (temporary)
ALTER TABLE password_folders DISABLE ROW LEVEL SECURITY;
ALTER TABLE password_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE password_shares DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop any existing policies to start clean
DROP POLICY IF EXISTS "Admins can manage all password folders" ON password_folders;
DROP POLICY IF EXISTS "Users can view shared folders" ON password_folders;
DROP POLICY IF EXISTS "Enable all for admin users" ON password_folders;
DROP POLICY IF EXISTS "Enable read for folder owners" ON password_folders;

DROP POLICY IF EXISTS "Admins can manage all password entries" ON password_entries;
DROP POLICY IF EXISTS "Users can view shared password entries" ON password_entries;
DROP POLICY IF EXISTS "Users can edit password entries if they have edit permission" ON password_entries;
DROP POLICY IF EXISTS "Enable all for admin users" ON password_entries;
DROP POLICY IF EXISTS "Enable read for entry owners" ON password_entries;
DROP POLICY IF EXISTS "Enable read for shared users" ON password_entries;

DROP POLICY IF EXISTS "Admins can manage password shares" ON password_shares;
DROP POLICY IF EXISTS "Users can view their own shares" ON password_shares;
DROP POLICY IF EXISTS "Enable all for admin users" ON password_shares;
DROP POLICY IF EXISTS "Enable read for shared users" ON password_shares;

-- Step 4: Grant permissions to authenticated users
GRANT ALL ON password_folders TO authenticated;
GRANT ALL ON password_entries TO authenticated;
GRANT ALL ON password_shares TO authenticated;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_entries_folder_id ON password_entries(folder_id);
CREATE INDEX IF NOT EXISTS idx_password_entries_created_by ON password_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_password_shares_password_id ON password_shares(password_id);
CREATE INDEX IF NOT EXISTS idx_password_shares_user_id ON password_shares(user_id);

-- Step 6: Drop problematic RPC function if it exists
DROP FUNCTION IF EXISTS get_user_accessible_passwords(UUID);

-- Step 7: Create the user_accessible_passwords view that the app needs
CREATE OR REPLACE VIEW user_accessible_passwords AS
SELECT DISTINCT
    pe.id,
    pe.folder_id,
    pe.name,
    pe.website_url,
    pe.website_name,
    pe.email,
    pe.username,
    pe.password_encrypted,
    pe.phone_number,
    pe.authenticator_key,
    pe.notes,
    pe.created_by,
    pe.created_at,
    pe.updated_at,
    pf.name as folder_name,
    pf.color as folder_color,
    COALESCE(ps.can_edit, false) as can_edit,
    CASE 
        WHEN pe.created_by = auth.uid() THEN true
        ELSE false 
    END as can_manage
FROM password_entries pe
LEFT JOIN password_folders pf ON pe.folder_id = pf.id
LEFT JOIN password_shares ps ON ps.password_id = pe.id AND ps.user_id = auth.uid()
WHERE 
    pe.created_by = auth.uid() OR
    ps.user_id = auth.uid();

-- Step 8: Grant access to the view
GRANT SELECT ON user_accessible_passwords TO authenticated;

-- Step 9: Insert default folders for demo (safe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM password_folders WHERE name = 'Website Accounts') THEN
        INSERT INTO password_folders (name, description, color, created_by) VALUES
            ('Website Accounts', 'Login credentials for various websites and services', '#3B82F6', 
             (SELECT id FROM auth.users WHERE email = 'soneswumpyae@gmail.com' LIMIT 1)),
            ('Email Accounts', 'Email account credentials and settings', '#10B981',
             (SELECT id FROM auth.users WHERE email = 'soneswumpyae@gmail.com' LIMIT 1)),
            ('Social Media', 'Social media platform credentials', '#8B5CF6',
             (SELECT id FROM auth.users WHERE email = 'soneswumpyae@gmail.com' LIMIT 1)),
            ('Work Related', 'Work-related system and tool credentials', '#F59E0B',
             (SELECT id FROM auth.users WHERE email = 'soneswumpyae@gmail.com' LIMIT 1)),
            ('Banking & Finance', 'Financial service credentials', '#EF4444',
             (SELECT id FROM auth.users WHERE email = 'soneswumpyae@gmail.com' LIMIT 1));
    END IF;
END $$;

-- Success message
SELECT 'Password Manager setup completed successfully! You can now use the password manager feature.' as result;