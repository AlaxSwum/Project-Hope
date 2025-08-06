-- Password Manager Schema for Hope IMS
-- Run this in Supabase SQL Editor

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

-- Enable Row Level Security
ALTER TABLE password_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for password_folders
CREATE POLICY "Admins can manage all password folders" ON password_folders
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
    );

-- RLS Policies for password_entries
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

-- RLS Policies for password_shares
CREATE POLICY "Admins can manage password shares" ON password_shares
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
    );

CREATE POLICY "Users can view their own shares" ON password_shares
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
    );

-- Grant permissions
GRANT ALL ON password_folders TO authenticated;
GRANT ALL ON password_entries TO authenticated;
GRANT ALL ON password_shares TO authenticated;
