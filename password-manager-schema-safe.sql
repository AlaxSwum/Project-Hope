-- Password Manager Schema for Hope IMS (Safe Version)
-- Run this in Supabase SQL Editor - handles existing objects gracefully

-- Create password manager folders table
CREATE TABLE IF NOT EXISTS password_folders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1',
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create password entries table
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

-- Create password sharing table
CREATE TABLE IF NOT EXISTS password_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    password_id UUID REFERENCES password_entries(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    can_edit BOOLEAN DEFAULT false,
    shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(password_id, user_id)
);

-- Enable Row Level Security (safe way)
DO $$ 
BEGIN
    ALTER TABLE password_folders ENABLE ROW LEVEL SECURITY;
EXCEPTION 
    WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE password_entries ENABLE ROW LEVEL SECURITY;
EXCEPTION 
    WHEN OTHERS THEN NULL;
END $$;
 
DO $$ 
BEGIN
    ALTER TABLE password_shares ENABLE ROW LEVEL SECURITY;
EXCEPTION 
    WHEN OTHERS THEN NULL;
END $$;

-- Drop existing policies if they exist (safe way)
DROP POLICY IF EXISTS "Admins can manage all password folders" ON password_folders;
DROP POLICY IF EXISTS "Users can view shared folders" ON password_folders;
DROP POLICY IF EXISTS "Admins can manage all password entries" ON password_entries;
DROP POLICY IF EXISTS "Users can view shared password entries" ON password_entries;
DROP POLICY IF EXISTS "Users can edit password entries if they have edit permission" ON password_entries;
DROP POLICY IF EXISTS "Admins can manage password shares" ON password_shares;
DROP POLICY IF EXISTS "Users can view their own shares" ON password_shares;

-- Create RLS Policies for password_folders
CREATE POLICY "Admins can manage all password folders" ON password_folders
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
    );

CREATE POLICY "Users can view shared folders" ON password_folders
    FOR SELECT USING (
        created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
    );

-- Create RLS Policies for password_entries
CREATE POLICY "Admins can manage all password entries" ON password_entries
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
    );

CREATE POLICY "Users can view shared password entries" ON password_entries
    FOR SELECT USING (
        created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM password_shares WHERE password_id = password_entries.id AND user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
    );

-- Create RLS Policies for password_shares
CREATE POLICY "Admins can manage password shares" ON password_shares
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
    );

CREATE POLICY "Users can view their own shares" ON password_shares
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
    );

-- Grant permissions (safe way)
DO $$
BEGIN
    GRANT ALL ON password_folders TO authenticated;
EXCEPTION 
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    GRANT ALL ON password_entries TO authenticated;
EXCEPTION 
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    GRANT ALL ON password_shares TO authenticated;
EXCEPTION 
    WHEN OTHERS THEN NULL;
END $$;

-- Create indexes for better performance (safe way)
CREATE INDEX IF NOT EXISTS idx_password_entries_folder_id ON password_entries(folder_id);
CREATE INDEX IF NOT EXISTS idx_password_entries_created_by ON password_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_password_shares_password_id ON password_shares(password_id);
CREATE INDEX IF NOT EXISTS idx_password_shares_user_id ON password_shares(user_id);

-- Insert some default folders for demo (safe way)
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
SELECT 'Password Manager schema setup completed successfully!' as result;