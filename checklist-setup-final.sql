-- Checklist System Database Setup (FINAL CORRECTED VERSION)
-- Hope Pharmacy IMS Checklist Management

-- Create checklist folders table
CREATE TABLE IF NOT EXISTS checklist_folders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Create checklists table
CREATE TABLE IF NOT EXISTS checklists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    folder_id UUID REFERENCES checklist_folders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_roles TEXT[] DEFAULT '{}', -- Array of roles: staff, pharmacist, c-level, administrator
    target_users UUID[] DEFAULT '{}', -- Specific user IDs if needed
    is_daily BOOLEAN DEFAULT true, -- Reset daily
    reset_time TIME DEFAULT '00:00:00', -- What time to reset daily
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create checklist items table
CREATE TABLE IF NOT EXISTS checklist_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user checklist progress table
CREATE TABLE IF NOT EXISTS user_checklist_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
    checklist_item_id UUID REFERENCES checklist_items(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    date_for DATE DEFAULT CURRENT_DATE, -- Which date this progress is for
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, checklist_item_id, date_for)
);

-- Create user daily checklist status table for quick overview
CREATE TABLE IF NOT EXISTS user_daily_checklist_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
    date_for DATE DEFAULT CURRENT_DATE,
    total_items INTEGER DEFAULT 0,
    completed_items INTEGER DEFAULT 0,
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    is_fully_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, checklist_id, date_for)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_checklist_folders_created_by ON checklist_folders(created_by);
CREATE INDEX IF NOT EXISTS idx_checklist_folders_active ON checklist_folders(is_active);

CREATE INDEX IF NOT EXISTS idx_checklists_folder_id ON checklists(folder_id);
CREATE INDEX IF NOT EXISTS idx_checklists_active ON checklists(is_active);
CREATE INDEX IF NOT EXISTS idx_checklists_roles ON checklists USING GIN(target_roles);
CREATE INDEX IF NOT EXISTS idx_checklists_users ON checklists USING GIN(target_users);

CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_sort_order ON checklist_items(sort_order);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_checklist_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_date ON user_checklist_progress(date_for);
CREATE INDEX IF NOT EXISTS idx_user_progress_checklist ON user_checklist_progress(checklist_id);

CREATE INDEX IF NOT EXISTS idx_daily_status_user_date ON user_daily_checklist_status(user_id, date_for);
CREATE INDEX IF NOT EXISTS idx_daily_status_checklist_date ON user_daily_checklist_status(checklist_id, date_for);

-- Enable Row Level Security
ALTER TABLE checklist_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_checklist_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_checklist_status ENABLE ROW LEVEL SECURITY;

-- SIMPLIFIED RLS Policies (avoiding complex joins with users table)

-- RLS Policies for checklist_folders - Allow admins to manage everything
DROP POLICY IF EXISTS "Allow admin full access to folders" ON checklist_folders;
CREATE POLICY "Allow admin full access to folders" ON checklist_folders
    FOR ALL USING (true);

-- RLS Policies for checklists - Allow admins to manage everything  
DROP POLICY IF EXISTS "Allow admin full access to checklists" ON checklists;
CREATE POLICY "Allow admin full access to checklists" ON checklists
    FOR ALL USING (true);

-- RLS Policies for checklist_items - Allow admins to manage everything
DROP POLICY IF EXISTS "Allow admin full access to checklist items" ON checklist_items;
CREATE POLICY "Allow admin full access to checklist items" ON checklist_items
    FOR ALL USING (true);

-- RLS Policies for user_checklist_progress - Allow all for now
DROP POLICY IF EXISTS "Allow access to progress" ON user_checklist_progress;
CREATE POLICY "Allow access to progress" ON user_checklist_progress
    FOR ALL USING (true);

-- RLS Policies for user_daily_checklist_status - Allow all for now
DROP POLICY IF EXISTS "Allow access to daily status" ON user_daily_checklist_status;
CREATE POLICY "Allow access to daily status" ON user_daily_checklist_status
    FOR ALL USING (true);

-- Function to update daily status when progress changes
CREATE OR REPLACE FUNCTION update_daily_checklist_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update daily status
    INSERT INTO user_daily_checklist_status (
        user_id, checklist_id, date_for, total_items, completed_items, completion_percentage, updated_at
    )
    SELECT 
        NEW.user_id,
        NEW.checklist_id,
        NEW.date_for,
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE completed = true) as completed_items,
        ROUND((COUNT(*) FILTER (WHERE completed = true) * 100.0 / COUNT(*)), 2) as completion_percentage,
        NOW()
    FROM user_checklist_progress ucp
    JOIN checklist_items ci ON ci.id = ucp.checklist_item_id
    WHERE ucp.user_id = NEW.user_id 
    AND ucp.checklist_id = NEW.checklist_id 
    AND ucp.date_for = NEW.date_for
    GROUP BY ucp.user_id, ucp.checklist_id, ucp.date_for
    ON CONFLICT (user_id, checklist_id, date_for) 
    DO UPDATE SET
        total_items = EXCLUDED.total_items,
        completed_items = EXCLUDED.completed_items,
        completion_percentage = EXCLUDED.completion_percentage,
        is_fully_completed = EXCLUDED.completed_items = EXCLUDED.total_items,
        completed_at = CASE 
            WHEN EXCLUDED.completed_items = EXCLUDED.total_items THEN NOW()
            ELSE user_daily_checklist_status.completed_at
        END,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating daily status
DROP TRIGGER IF EXISTS trigger_update_daily_status ON user_checklist_progress;
CREATE TRIGGER trigger_update_daily_status
    AFTER INSERT OR UPDATE OR DELETE ON user_checklist_progress
    FOR EACH ROW EXECUTE FUNCTION update_daily_checklist_status();

-- Function to reset daily checklists
CREATE OR REPLACE FUNCTION reset_daily_checklists()
RETURNS void AS $$
BEGIN
    -- This function can be called daily to reset checklist progress
    -- For now, we'll rely on the date_for field to handle daily resets
    -- The application will check if progress exists for today's date
    
    -- Update checklists that should reset based on their reset_time
    -- This is placeholder for future enhancement
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for testing
INSERT INTO checklist_folders (name, description, color, created_by) 
VALUES ('Daily Operations', 'Standard daily operational checklists', '#10B981', 
        (SELECT id FROM auth.users WHERE email = 'soneswumpyae@gmail.com'))
ON CONFLICT DO NOTHING;

-- Insert sample checklist
INSERT INTO checklists (folder_id, name, description, target_roles, is_daily, created_by)
VALUES (
    (SELECT id FROM checklist_folders WHERE name = 'Daily Operations'),
    'Opening Procedures',
    'Tasks to complete when opening the pharmacy each day',
    ARRAY['staff', 'pharmacist'],
    true,
    (SELECT id FROM auth.users WHERE email = 'soneswumpyae@gmail.com')
)
ON CONFLICT DO NOTHING;

-- Insert sample checklist items (FIXED VERSION)
INSERT INTO checklist_items (checklist_id, title, description, sort_order) 
VALUES 
    ((SELECT id FROM checklists WHERE name = 'Opening Procedures'), 'Turn on all equipment', 'Ensure all computers, printers, and pharmacy equipment are powered on', 0),
    ((SELECT id FROM checklists WHERE name = 'Opening Procedures'), 'Check temperature logs', 'Verify refrigerator and freezer temperatures are within acceptable ranges', 1),
    ((SELECT id FROM checklists WHERE name = 'Opening Procedures'), 'Count register cash', 'Verify starting cash amount in register', 2),
    ((SELECT id FROM checklists WHERE name = 'Opening Procedures'), 'Check inventory alerts', 'Review any low stock or expired medication alerts', 3),
    ((SELECT id FROM checklists WHERE name = 'Opening Procedures'), 'Unlock pharmacy doors', 'Open pharmacy for business and unlock customer entrance', 4)
ON CONFLICT DO NOTHING; 