-- Fix for password_encrypted null constraint violation
-- This script makes the password_encrypted field optional to allow entries without passwords
-- Run this in Supabase SQL Editor

-- Make password_encrypted field optional (nullable)
ALTER TABLE password_entries 
ALTER COLUMN password_encrypted DROP NOT NULL;

-- Verify the change
SELECT 
    column_name, 
    is_nullable, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'password_entries' 
AND column_name = 'password_encrypted';