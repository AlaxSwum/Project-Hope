-- Create holidays table for managing company holidays
CREATE TABLE IF NOT EXISTS holidays (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(50) DEFAULT 'mandatory', -- 'mandatory', 'optional', 'branch_specific'
    is_paid BOOLEAN DEFAULT true,
    is_recurring BOOLEAN DEFAULT false, -- For annual holidays like Christmas
    branch_id UUID REFERENCES branches(id), -- NULL for company-wide holidays
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_branch ON holidays(branch_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date_branch ON holidays(date, branch_id);

-- Add RLS policies
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view holidays" ON holidays
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage holidays" ON holidays
    FOR ALL USING (auth.role() = 'authenticated');

-- Insert some common UK holidays as examples
INSERT INTO holidays (name, date, type, is_paid, is_recurring, description) VALUES
('New Year''s Day', '2024-01-01', 'mandatory', true, true, 'New Year celebration'),
('Good Friday', '2024-03-29', 'mandatory', true, false, 'Easter holiday'),
('Easter Monday', '2024-04-01', 'mandatory', true, false, 'Easter holiday'),
('Early May Bank Holiday', '2024-05-06', 'mandatory', true, false, 'Spring bank holiday'),
('Spring Bank Holiday', '2024-05-27', 'mandatory', true, false, 'Late spring bank holiday'),
('Summer Bank Holiday', '2024-08-26', 'mandatory', true, false, 'Summer bank holiday'),
('Christmas Day', '2024-12-25', 'mandatory', true, true, 'Christmas celebration'),
('Boxing Day', '2024-12-26', 'mandatory', true, true, 'Boxing Day holiday');

-- Create holiday_overrides table for employees who work on holidays
CREATE TABLE IF NOT EXISTS holiday_overrides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    holiday_id UUID NOT NULL REFERENCES holidays(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    override_type VARCHAR(50) NOT NULL, -- 'working', 'time_off', 'half_day'
    pay_multiplier DECIMAL(3,2) DEFAULT 1.5, -- Holiday pay rate (e.g., 1.5x for working on holiday)
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(holiday_id, user_id, branch_id)
);

-- Create indexes for holiday overrides
CREATE INDEX IF NOT EXISTS idx_holiday_overrides_holiday ON holiday_overrides(holiday_id);
CREATE INDEX IF NOT EXISTS idx_holiday_overrides_user ON holiday_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_holiday_overrides_branch ON holiday_overrides(branch_id);

-- Add RLS policies for holiday overrides
ALTER TABLE holiday_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage holiday overrides" ON holiday_overrides
    FOR ALL USING (auth.role() = 'authenticated');

-- Add comments
COMMENT ON TABLE holidays IS 'Stores company and branch-specific holidays';
COMMENT ON COLUMN holidays.type IS 'Type of holiday: mandatory, optional, or branch_specific';
COMMENT ON COLUMN holidays.is_paid IS 'Whether employees get paid for this holiday';
COMMENT ON COLUMN holidays.is_recurring IS 'Whether this holiday repeats annually';
COMMENT ON COLUMN holidays.pay_multiplier IS 'Pay multiplier for working on this holiday';

COMMENT ON TABLE holiday_overrides IS 'Stores individual employee holiday work overrides';
COMMENT ON COLUMN holiday_overrides.override_type IS 'How employee handles this holiday: working, time_off, half_day';
COMMENT ON COLUMN holiday_overrides.pay_multiplier IS 'Pay rate multiplier for working on holiday';
