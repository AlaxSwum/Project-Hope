-- Password Manager Final Fix
-- Remove problematic RPC function and fix user access

-- Drop the problematic function that has ambiguous column references
DROP FUNCTION IF EXISTS get_user_accessible_passwords(UUID);

-- Create a simple view for user accessible passwords without ambiguous references
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
    ps.can_edit,
    CASE 
        WHEN pe.created_by = auth.uid() THEN true
        ELSE false 
    END as can_manage
FROM password_entries pe
LEFT JOIN password_folders pf ON pe.folder_id = pf.id
LEFT JOIN password_shares ps ON ps.password_id = pe.id
WHERE 
    pe.created_by = auth.uid() OR
    ps.user_id = auth.uid();

-- Grant access to the view
GRANT SELECT ON user_accessible_passwords TO authenticated;

-- Success message
SELECT 'User accessible passwords view created - RPC function removed' as result;