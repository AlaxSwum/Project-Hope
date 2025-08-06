-- Password Manager Schema Fix - Resolve RLS Policy Recursion
-- Run this in Supabase SQL Editor to fix the infinite recursion issue

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Admins can manage all password folders" ON password_folders;
DROP POLICY IF EXISTS "Users can view shared folders" ON password_folders;
DROP POLICY IF EXISTS "Admins can manage all password entries" ON password_entries;
DROP POLICY IF EXISTS "Users can view shared password entries" ON password_entries;
DROP POLICY IF EXISTS "Users can edit password entries if they have edit permission" ON password_entries;
DROP POLICY IF EXISTS "Admins can manage password shares" ON password_shares;
DROP POLICY IF EXISTS "Users can view their own shares" ON password_shares;

-- Create simplified RLS Policies without recursion

-- Password Folders Policies
CREATE POLICY "Enable all for admin users" ON password_folders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'administrator'
        )
    );

CREATE POLICY "Enable read for folder owners" ON password_folders
    FOR SELECT USING (created_by = auth.uid());

-- Password Entries Policies  
CREATE POLICY "Enable all for admin users" ON password_entries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'administrator'
        )
    );

CREATE POLICY "Enable read for entry owners" ON password_entries
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Enable read for shared users" ON password_entries
    FOR SELECT USING (
        id IN (
            SELECT password_id 
            FROM password_shares 
            WHERE user_id = auth.uid()
        )
    );

-- Password Shares Policies
CREATE POLICY "Enable all for admin users" ON password_shares
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'administrator'
        )
    );

CREATE POLICY "Enable read for shared users" ON password_shares
    FOR SELECT USING (user_id = auth.uid());

-- Success message
SELECT 'RLS policies fixed - infinite recursion resolved!' as result;