-- Create employee_schedules table for storing employee work schedules
CREATE TABLE IF NOT EXISTS employee_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    monday_start TIME,
    monday_end TIME,
    tuesday_start TIME,
    tuesday_end TIME,
    wednesday_start TIME,
    wednesday_end TIME,
    thursday_start TIME,
    thursday_end TIME,
    friday_start TIME,
    friday_end TIME,
    saturday_start TIME,
    saturday_end TIME,
    sunday_start TIME,
    sunday_end TIME,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_schedules_user_id ON employee_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_schedules_branch_id ON employee_schedules(branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_schedules_user_branch ON employee_schedules(user_id, branch_id);

-- Add RLS policies
ALTER TABLE employee_schedules ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view schedules
CREATE POLICY "Allow authenticated users to view schedules" ON employee_schedules
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert schedules
CREATE POLICY "Allow authenticated users to insert schedules" ON employee_schedules
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update schedules
CREATE POLICY "Allow authenticated users to update schedules" ON employee_schedules
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete schedules
CREATE POLICY "Allow authenticated users to delete schedules" ON employee_schedules
    FOR DELETE USING (auth.role() = 'authenticated');

-- Add comments
COMMENT ON TABLE employee_schedules IS 'Stores work schedules for employees at different branches';
COMMENT ON COLUMN employee_schedules.user_id IS 'Reference to the employee user';
COMMENT ON COLUMN employee_schedules.branch_id IS 'Reference to the branch where this schedule applies';
COMMENT ON COLUMN employee_schedules.is_active IS 'Whether this schedule is currently active';
