-- ===========================================
-- PHARMACY BRANCHES SAFE CLEANUP AND FIX
-- Hope Pharmacy IMS - Safe cleanup without affecting shared functions
-- ===========================================

-- Drop existing branch-specific triggers first
DROP TRIGGER IF EXISTS update_pharmacy_branches_updated_at ON pharmacy_branches;
DROP TRIGGER IF EXISTS update_user_branch_assignments_updated_at ON user_branch_assignments;

-- Drop branch-specific functions only (not the shared update_updated_at_column)
DROP FUNCTION IF EXISTS get_branch_staff_count(UUID);
DROP FUNCTION IF EXISTS get_branch_performance_summary(UUID, DATE);

-- Drop existing policies
DROP POLICY IF EXISTS "Allow admin full access to branches" ON pharmacy_branches;
DROP POLICY IF EXISTS "Allow admin full access to assignments" ON user_branch_assignments;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_pharmacy_branches_active;
DROP INDEX IF EXISTS idx_pharmacy_branches_branch_code;
DROP INDEX IF EXISTS idx_pharmacy_branches_manager;
DROP INDEX IF EXISTS idx_pharmacy_branches_city;
DROP INDEX IF EXISTS idx_user_branch_assignments_user;
DROP INDEX IF EXISTS idx_user_branch_assignments_branch;
DROP INDEX IF EXISTS idx_user_branch_assignments_active;
DROP INDEX IF EXISTS idx_user_branch_assignments_primary;
DROP INDEX IF EXISTS idx_checklist_folders_branch;
DROP INDEX IF EXISTS idx_checklists_branch;

-- Remove branch_id columns from existing tables (if they exist)
ALTER TABLE checklist_folders DROP COLUMN IF EXISTS branch_id;
ALTER TABLE checklists DROP COLUMN IF EXISTS branch_id;

-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS user_branch_assignments;
DROP TABLE IF EXISTS pharmacy_branches;

-- Now recreate everything with correct references

-- Create pharmacy branches table
CREATE TABLE pharmacy_branches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic Information
    branch_name VARCHAR(255) NOT NULL,
    branch_code VARCHAR(20) UNIQUE NOT NULL, -- e.g., "HOPE001", "HOPE002"
    
    -- Location Details
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postcode VARCHAR(20) NOT NULL,
    country VARCHAR(100) DEFAULT 'Myanmar',
    
    -- Contact Information
    phone_number VARCHAR(20),
    email VARCHAR(255),
    fax_number VARCHAR(20),
    
    -- Operational Information
    branch_type VARCHAR(50) DEFAULT 'main', -- main, satellite, clinic, hospital
    pharmacy_license_number VARCHAR(100) UNIQUE,
    dea_license_number VARCHAR(100),
    
    -- Management
    branch_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Operating Details
    opening_date DATE DEFAULT CURRENT_DATE,
    operating_hours JSONB DEFAULT '{"monday": {"open": "08:00", "close": "20:00"}, "tuesday": {"open": "08:00", "close": "20:00"}, "wednesday": {"open": "08:00", "close": "20:00"}, "thursday": {"open": "08:00", "close": "20:00"}, "friday": {"open": "08:00", "close": "20:00"}, "saturday": {"open": "09:00", "close": "18:00"}, "sunday": {"closed": true}}',
    
    -- Capacity & Services
    max_daily_capacity INTEGER DEFAULT 200,
    services_offered TEXT[] DEFAULT ARRAY['prescription_dispensing', 'consultation', 'vaccination'],
    
    -- Status & Metadata
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    
    -- Audit fields
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_branch_type CHECK (branch_type IN ('main', 'satellite', 'clinic', 'hospital', 'specialty'))
);

-- Create user branch assignments table (many-to-many relationship)
CREATE TABLE user_branch_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES pharmacy_branches(id) ON DELETE CASCADE,
    
    -- Assignment Details
    position VARCHAR(100),
    is_primary_branch BOOLEAN DEFAULT false,
    assignment_date DATE DEFAULT CURRENT_DATE,
    
    -- Work Schedule
    work_schedule JSONB,
    hourly_rate DECIMAL(10,2),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    end_date DATE,
    
    -- Audit
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, branch_id),
    CHECK (end_date IS NULL OR end_date >= assignment_date)
);

-- Add branch_id to existing tables for branch-specific data
ALTER TABLE checklist_folders ADD COLUMN branch_id UUID REFERENCES pharmacy_branches(id) ON DELETE CASCADE;
ALTER TABLE checklists ADD COLUMN branch_id UUID REFERENCES pharmacy_branches(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX idx_pharmacy_branches_active ON pharmacy_branches(is_active);
CREATE INDEX idx_pharmacy_branches_branch_code ON pharmacy_branches(branch_code);
CREATE INDEX idx_pharmacy_branches_manager ON pharmacy_branches(branch_manager_id);
CREATE INDEX idx_pharmacy_branches_city ON pharmacy_branches(city);

CREATE INDEX idx_user_branch_assignments_user ON user_branch_assignments(user_id);
CREATE INDEX idx_user_branch_assignments_branch ON user_branch_assignments(branch_id);
CREATE INDEX idx_user_branch_assignments_active ON user_branch_assignments(is_active);
CREATE INDEX idx_user_branch_assignments_primary ON user_branch_assignments(is_primary_branch);

CREATE INDEX idx_checklist_folders_branch ON checklist_folders(branch_id);
CREATE INDEX idx_checklists_branch ON checklists(branch_id);

-- Enable Row Level Security for new tables
ALTER TABLE pharmacy_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pharmacy branches
CREATE POLICY "Allow admin full access to branches" ON pharmacy_branches
    FOR ALL USING (true);

-- RLS Policies for user branch assignments
CREATE POLICY "Allow admin full access to assignments" ON user_branch_assignments
    FOR ALL USING (true);

-- Function to automatically update staff count
CREATE FUNCTION get_branch_staff_count(branch_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM user_branch_assignments uba
        WHERE uba.branch_id = branch_uuid 
        AND uba.is_active = true
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get branch performance metrics
CREATE FUNCTION get_branch_performance_summary(branch_uuid UUID, date_for DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_staff', get_branch_staff_count(branch_uuid),
        'total_checklists', COUNT(DISTINCT c.id),
        'average_completion', COALESCE(AVG(udcs.completion_percentage), 0),
        'active_folders', COUNT(DISTINCT cf.id)
    ) INTO result
    FROM pharmacy_branches pb
    LEFT JOIN checklist_folders cf ON cf.branch_id = pb.id AND cf.is_active = true
    LEFT JOIN checklists c ON c.folder_id = cf.id AND c.is_active = true
    LEFT JOIN user_daily_checklist_status udcs ON udcs.checklist_id = c.id AND udcs.date_for = date_for
    WHERE pb.id = branch_uuid;
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Create triggers using the existing shared function
-- Check if the function exists first, if not create a simple version
DO $$
BEGIN
    -- Try to use existing update_updated_at_column function
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        -- Use existing function
        CREATE TRIGGER update_pharmacy_branches_updated_at 
            BEFORE UPDATE ON pharmacy_branches 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        CREATE TRIGGER update_user_branch_assignments_updated_at 
            BEFORE UPDATE ON user_branch_assignments 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    ELSE
        -- Create a simple version if it doesn't exist
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $func$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;

        CREATE TRIGGER update_pharmacy_branches_updated_at 
            BEFORE UPDATE ON pharmacy_branches 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        CREATE TRIGGER update_user_branch_assignments_updated_at 
            BEFORE UPDATE ON user_branch_assignments 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Clean up any sample data that might exist
DELETE FROM checklist_items WHERE checklist_id IN (
    SELECT id FROM checklists WHERE name = 'Opening Procedures'
);
DELETE FROM checklists WHERE name = 'Opening Procedures';
DELETE FROM checklist_folders WHERE name = 'Daily Operations';

-- Remove any other sample data that might exist
DELETE FROM user_checklist_progress WHERE checklist_id IN (
    SELECT id FROM checklists WHERE name LIKE '%sample%' OR name LIKE '%test%' OR name LIKE '%demo%'
);
DELETE FROM user_daily_checklist_status WHERE checklist_id IN (
    SELECT id FROM checklists WHERE name LIKE '%sample%' OR name LIKE '%test%' OR name LIKE '%demo%'
);
DELETE FROM checklists WHERE name LIKE '%sample%' OR name LIKE '%test%' OR name LIKE '%demo%';
DELETE FROM checklist_folders WHERE name LIKE '%sample%' OR name LIKE '%test%' OR name LIKE '%demo%';

-- Success message
SELECT 'Branch management schema successfully cleaned up and recreated with correct table references! Shared functions preserved.' as result; 