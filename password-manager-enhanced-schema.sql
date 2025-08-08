-- Enhanced Password Manager Schema with Multiple Phone Numbers and Custom Fields
-- Similar to Bitwarden's flexible field system
-- Run this in Supabase SQL Editor AFTER running password-encrypted-field-fix.sql

-- =====================================================
-- 1. MULTIPLE PHONE NUMBERS SUPPORT
-- =====================================================

-- Create table for multiple phone numbers per password entry
CREATE TABLE IF NOT EXISTS password_entry_phones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    password_entry_id UUID REFERENCES password_entries(id) ON DELETE CASCADE,
    phone_number VARCHAR(50) NOT NULL,
    phone_label VARCHAR(100) DEFAULT 'Phone', -- e.g., "Mobile", "Work", "Home", "Emergency", "WhatsApp"
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- 2. CUSTOM FIELDS SUPPORT (Like Bitwarden)
-- =====================================================

-- Create table for custom fields per password entry
CREATE TABLE IF NOT EXISTS password_entry_custom_fields (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    password_entry_id UUID REFERENCES password_entries(id) ON DELETE CASCADE,
    field_name VARCHAR(255) NOT NULL, -- e.g., "Security Question", "PIN", "Account Number"
    field_value TEXT, -- The actual value (can be encrypted if sensitive)
    field_type VARCHAR(50) DEFAULT 'text', -- 'text', 'password', 'email', 'url', 'number', 'date', 'boolean'
    is_encrypted BOOLEAN DEFAULT false, -- Whether the field_value should be encrypted
    field_order INTEGER DEFAULT 0, -- For ordering custom fields in UI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- 3. MULTIPLE EMAIL ADDRESSES SUPPORT
-- =====================================================

-- Create table for multiple email addresses per password entry
CREATE TABLE IF NOT EXISTS password_entry_emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    password_entry_id UUID REFERENCES password_entries(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    email_label VARCHAR(100) DEFAULT 'Email', -- e.g., "Primary", "Recovery", "Work", "Personal"
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE password_entry_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_entry_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_entry_emails ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

-- Policies for password_entry_phones
CREATE POLICY "Admins can manage all password entry phones" ON password_entry_phones
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
    );

CREATE POLICY "Users can view accessible password entry phones" ON password_entry_phones
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM password_entries pe 
            WHERE pe.id = password_entry_phones.password_entry_id 
            AND (
                pe.created_by = auth.uid() OR
                EXISTS (SELECT 1 FROM password_shares WHERE password_id = pe.id AND user_id = auth.uid()) OR
                EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
            )
        )
    );

-- Policies for password_entry_custom_fields
CREATE POLICY "Admins can manage all password entry custom fields" ON password_entry_custom_fields
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
    );

CREATE POLICY "Users can view accessible password entry custom fields" ON password_entry_custom_fields
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM password_entries pe 
            WHERE pe.id = password_entry_custom_fields.password_entry_id 
            AND (
                pe.created_by = auth.uid() OR
                EXISTS (SELECT 1 FROM password_shares WHERE password_id = pe.id AND user_id = auth.uid()) OR
                EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
            )
        )
    );

-- Policies for password_entry_emails
CREATE POLICY "Admins can manage all password entry emails" ON password_entry_emails
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
    );

CREATE POLICY "Users can view accessible password entry emails" ON password_entry_emails
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM password_entries pe 
            WHERE pe.id = password_entry_emails.password_entry_id 
            AND (
                pe.created_by = auth.uid() OR
                EXISTS (SELECT 1 FROM password_shares WHERE password_id = pe.id AND user_id = auth.uid()) OR
                EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'administrator')
            )
        )
    );

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

GRANT ALL ON password_entry_phones TO authenticated;
GRANT ALL ON password_entry_custom_fields TO authenticated;
GRANT ALL ON password_entry_emails TO authenticated;

-- =====================================================
-- 7. CREATE VIEWS FOR EASY QUERYING
-- =====================================================

-- View to get password entries with all related data
CREATE OR REPLACE VIEW password_entries_full_details AS
SELECT 
    pe.*,
    pf.name as folder_name,
    pf.color as folder_color,
    -- Aggregate phone numbers
    COALESCE(
        json_agg(
            json_build_object(
                'id', pep.id,
                'phone_number', pep.phone_number,
                'phone_label', pep.phone_label,
                'is_primary', pep.is_primary
            ) ORDER BY pep.is_primary DESC, pep.phone_label
        ) FILTER (WHERE pep.id IS NOT NULL), 
        '[]'::json
    ) as phone_numbers,
    -- Aggregate emails
    COALESCE(
        json_agg(
            json_build_object(
                'id', pee.id,
                'email_address', pee.email_address,
                'email_label', pee.email_label,
                'is_primary', pee.is_primary
            ) ORDER BY pee.is_primary DESC, pee.email_label
        ) FILTER (WHERE pee.id IS NOT NULL), 
        '[]'::json
    ) as email_addresses,
    -- Aggregate custom fields
    COALESCE(
        json_agg(
            json_build_object(
                'id', pecf.id,
                'field_name', pecf.field_name,
                'field_value', pecf.field_value,
                'field_type', pecf.field_type,
                'is_encrypted', pecf.is_encrypted,
                'field_order', pecf.field_order
            ) ORDER BY pecf.field_order, pecf.field_name
        ) FILTER (WHERE pecf.id IS NOT NULL), 
        '[]'::json
    ) as custom_fields
FROM password_entries pe
LEFT JOIN password_folders pf ON pe.folder_id = pf.id
LEFT JOIN password_entry_phones pep ON pe.id = pep.password_entry_id
LEFT JOIN password_entry_emails pee ON pe.id = pee.password_entry_id
LEFT JOIN password_entry_custom_fields pecf ON pe.id = pecf.password_entry_id
GROUP BY pe.id, pf.name, pf.color;

-- Note: Views inherit RLS from their underlying tables, so we don't need separate policies

-- =====================================================
-- 8. MIGRATION: Move existing phone number to new table
-- =====================================================

-- Insert existing phone numbers into the new phone table
INSERT INTO password_entry_phones (password_entry_id, phone_number, phone_label, is_primary)
SELECT 
    id as password_entry_id,
    phone_number,
    'Primary' as phone_label,
    true as is_primary
FROM password_entries 
WHERE phone_number IS NOT NULL AND phone_number != '';

-- Insert existing email into the new email table  
INSERT INTO password_entry_emails (password_entry_id, email_address, email_label, is_primary)
SELECT 
    id as password_entry_id,
    email,
    'Primary' as email_label,
    true as is_primary
FROM password_entries 
WHERE email IS NOT NULL AND email != '';

-- Note: We'll keep the original phone_number and email columns in password_entries
-- for backward compatibility, but new entries will use the enhanced tables