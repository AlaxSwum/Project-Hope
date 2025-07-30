-- Time Tracking System Database Schema (Corrected for existing pharmacy_branches table)

-- Table for storing branch location coordinates
CREATE TABLE IF NOT EXISTS branch_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES pharmacy_branches(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  radius_meters INTEGER DEFAULT 50, -- Allowed distance for clock-in
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for employee work schedules
CREATE TABLE IF NOT EXISTS employee_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES pharmacy_branches(id) ON DELETE CASCADE,
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
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing clock-in/clock-out entries
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES pharmacy_branches(id) ON DELETE CASCADE,
  clock_in_time TIMESTAMP WITH TIME ZONE,
  clock_out_time TIMESTAMP WITH TIME ZONE,
  clock_in_latitude DECIMAL(10, 8),
  clock_in_longitude DECIMAL(11, 8),
  clock_out_latitude DECIMAL(10, 8),
  clock_out_longitude DECIMAL(11, 8),
  total_hours DECIMAL(4, 2),
  status VARCHAR(20) DEFAULT 'clocked_in', -- clocked_in, clocked_out, break, late, early_out
  notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for break periods during work
CREATE TABLE IF NOT EXISTS break_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE CASCADE,
  break_start TIMESTAMP WITH TIME ZONE NOT NULL,
  break_end TIMESTAMP WITH TIME ZONE,
  break_duration_minutes INTEGER,
  break_type VARCHAR(20) DEFAULT 'regular', -- regular, lunch, emergency
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_time_entries_user_clock_in ON time_entries(user_id, clock_in_time);
CREATE INDEX IF NOT EXISTS idx_time_entries_branch ON time_entries(branch_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(clock_in_time) WHERE clock_in_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employee_schedules_user ON employee_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_branch_locations_branch ON branch_locations(branch_id);

-- RLS (Row Level Security) policies
ALTER TABLE branch_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE break_entries ENABLE ROW LEVEL SECURITY;

-- Policies for branch_locations
DROP POLICY IF EXISTS "Branch locations visible to all authenticated users" ON branch_locations;
CREATE POLICY "Branch locations visible to all authenticated users" ON branch_locations
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Only admins can manage branch locations" ON branch_locations;
CREATE POLICY "Only admins can manage branch locations" ON branch_locations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'administrator'
    )
  );

-- Policies for employee_schedules
DROP POLICY IF EXISTS "Users can view their own schedules" ON employee_schedules;
CREATE POLICY "Users can view their own schedules" ON employee_schedules
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all schedules" ON employee_schedules;
CREATE POLICY "Admins can manage all schedules" ON employee_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'administrator'
    )
  );

-- Policies for time_entries
DROP POLICY IF EXISTS "Users can view their own time entries" ON time_entries;
CREATE POLICY "Users can view their own time entries" ON time_entries
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own time entries" ON time_entries;
CREATE POLICY "Users can insert their own time entries" ON time_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own incomplete time entries" ON time_entries;
CREATE POLICY "Users can update their own incomplete time entries" ON time_entries
  FOR UPDATE USING (
    user_id = auth.uid() 
    AND (clock_out_time IS NULL OR status != 'clocked_out')
  );

DROP POLICY IF EXISTS "Admins can manage all time entries" ON time_entries;
CREATE POLICY "Admins can manage all time entries" ON time_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'administrator'
    )
  );

-- Policies for break_entries
DROP POLICY IF EXISTS "Users can manage breaks for their own time entries" ON break_entries;
CREATE POLICY "Users can manage breaks for their own time entries" ON break_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM time_entries 
      WHERE time_entries.id = break_entries.time_entry_id 
      AND time_entries.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage all break entries" ON break_entries;
CREATE POLICY "Admins can manage all break entries" ON break_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'administrator'
    )
  );

-- Function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance_meters(
  lat1 DECIMAL, lon1 DECIMAL, 
  lat2 DECIMAL, lon2 DECIMAL
) 
RETURNS INTEGER AS $$
DECLARE
  r INTEGER := 6371000; -- Earth radius in meters
  dlat DECIMAL;
  dlon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  dlat := RADIANS(lat2 - lat1);
  dlon := RADIANS(lon2 - lon1);
  
  a := SIN(dlat/2) * SIN(dlat/2) + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlon/2) * SIN(dlon/2);
  c := 2 * ATAN2(SQRT(a), SQRT(1-a));
  
  RETURN ROUND(r * c);
END;
$$ LANGUAGE plpgsql;

-- Function to check if location is within allowed radius
CREATE OR REPLACE FUNCTION is_within_allowed_location(
  user_lat DECIMAL, 
  user_lon DECIMAL, 
  branch_id_param UUID
) 
RETURNS BOOLEAN AS $$
DECLARE
  branch_loc RECORD;
  distance INTEGER;
BEGIN
  SELECT latitude, longitude, radius_meters 
  INTO branch_loc
  FROM branch_locations 
  WHERE branch_id = branch_id_param
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  distance := calculate_distance_meters(
    user_lat, user_lon, 
    branch_loc.latitude, branch_loc.longitude
  );
  
  RETURN distance <= branch_loc.radius_meters;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically calculate total hours when clocking out
CREATE OR REPLACE FUNCTION calculate_total_hours()
RETURNS TRIGGER AS $$
DECLARE
  break_time INTEGER := 0;
BEGIN
  -- Only calculate if clocking out
  IF NEW.clock_out_time IS NOT NULL AND OLD.clock_out_time IS NULL THEN
    -- Calculate total break time in minutes
    SELECT COALESCE(SUM(break_duration_minutes), 0)
    INTO break_time
    FROM break_entries
    WHERE time_entry_id = NEW.id;
    
    -- Calculate total hours (excluding breaks)
    NEW.total_hours := EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 3600.0 - (break_time / 60.0);
    NEW.status := 'clocked_out';
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate hours
DROP TRIGGER IF EXISTS calculate_hours_trigger ON time_entries;
CREATE TRIGGER calculate_hours_trigger
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_hours();

-- Function to get current day schedule for a user
CREATE OR REPLACE FUNCTION get_user_schedule_today(user_id_param UUID)
RETURNS TABLE(
  start_time TIME,
  end_time TIME,
  day_name TEXT
) AS $$
DECLARE
  current_day TEXT;
BEGIN
  current_day := LOWER(TO_CHAR(CURRENT_DATE, 'Day'));
  current_day := TRIM(current_day);
  
  RETURN QUERY
  SELECT 
    CASE current_day
      WHEN 'monday' THEN monday_start
      WHEN 'tuesday' THEN tuesday_start
      WHEN 'wednesday' THEN wednesday_start
      WHEN 'thursday' THEN thursday_start
      WHEN 'friday' THEN friday_start
      WHEN 'saturday' THEN saturday_start
      WHEN 'sunday' THEN sunday_start
    END as start_time,
    CASE current_day
      WHEN 'monday' THEN monday_end
      WHEN 'tuesday' THEN tuesday_end
      WHEN 'wednesday' THEN wednesday_end
      WHEN 'thursday' THEN thursday_end
      WHEN 'friday' THEN friday_end
      WHEN 'saturday' THEN saturday_end
      WHEN 'sunday' THEN sunday_end
    END as end_time,
    current_day as day_name
  FROM employee_schedules
  WHERE employee_schedules.user_id = user_id_param
    AND is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql; 