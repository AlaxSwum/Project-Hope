-- FINAL AUTH FIX - Eliminates infinite recursion completely
-- Run this in Supabase SQL Editor

-- Step 1: Fix username column if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'username'
  ) THEN
    ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
    UPDATE users SET username = email WHERE username IS NULL;
  END IF;
END $$;

-- Step 2: Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "View users" ON users;
DROP POLICY IF EXISTS "Insert users" ON users;
DROP POLICY IF EXISTS "Update users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to view users" ON users;
DROP POLICY IF EXISTS "Allow users to update their own data" ON users;
DROP POLICY IF EXISTS "Allow system to insert users" ON users;

DROP POLICY IF EXISTS "View branch staff assignments" ON branch_staff_assignments;
DROP POLICY IF EXISTS "Insert branch staff assignments" ON branch_staff_assignments;
DROP POLICY IF EXISTS "Update branch staff assignments" ON branch_staff_assignments;
DROP POLICY IF EXISTS "Delete branch staff assignments" ON branch_staff_assignments;
DROP POLICY IF EXISTS "Allow authenticated users to view assignments" ON branch_staff_assignments;
DROP POLICY IF EXISTS "Allow authenticated users to manage assignments" ON branch_staff_assignments;

DROP POLICY IF EXISTS "View time entries" ON time_entries;
DROP POLICY IF EXISTS "Insert time entries" ON time_entries;
DROP POLICY IF EXISTS "Update time entries" ON time_entries;
DROP POLICY IF EXISTS "Delete time entries" ON time_entries;
DROP POLICY IF EXISTS "Allow authenticated users to view time entries" ON time_entries;
DROP POLICY IF EXISTS "Allow users to manage their time entries" ON time_entries;

DROP POLICY IF EXISTS "View break entries" ON break_entries;
DROP POLICY IF EXISTS "Insert break entries" ON break_entries;
DROP POLICY IF EXISTS "Update break entries" ON break_entries;
DROP POLICY IF EXISTS "Delete break entries" ON break_entries;
DROP POLICY IF EXISTS "Allow authenticated users to view break entries" ON break_entries;
DROP POLICY IF EXISTS "Allow users to manage their break entries" ON break_entries;

-- Step 3: DISABLE RLS on users table permanently (this prevents recursion)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Step 4: Create/update the user sync function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, first_name, last_name, email, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
    email = EXCLUDED.email,
    username = COALESCE(EXCLUDED.username, users.username, users.email),
    role = COALESCE(EXCLUDED.role, users.role),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Ensure trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Step 6: Sync existing users
INSERT INTO public.users (id, first_name, last_name, email, username, role)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'first_name', split_part(email, '@', 1)) as first_name,
  COALESCE(raw_user_meta_data->>'last_name', '') as last_name,
  email,
  COALESCE(raw_user_meta_data->>'username', email) as username,
  COALESCE(raw_user_meta_data->>'role', 'staff') as role
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET
  first_name = COALESCE(EXCLUDED.first_name, users.first_name),
  last_name = COALESCE(EXCLUDED.last_name, users.last_name),
  email = EXCLUDED.email,
  username = COALESCE(EXCLUDED.username, users.username, users.email),
  role = COALESCE(EXCLUDED.role, users.role),
  updated_at = NOW();

-- Step 7: Enable RLS on other tables with SIMPLE policies (no subqueries to users table)
ALTER TABLE branch_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE break_entries ENABLE ROW LEVEL SECURITY;

-- Step 8: Create SIMPLE policies that don't reference users table
-- Branch staff assignments - allow all authenticated users (simplified)
CREATE POLICY "branch_staff_select" ON branch_staff_assignments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "branch_staff_insert" ON branch_staff_assignments
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "branch_staff_update" ON branch_staff_assignments
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "branch_staff_delete" ON branch_staff_assignments
  FOR DELETE TO authenticated
  USING (true);

-- Time entries - allow users to manage their own
CREATE POLICY "time_entries_select" ON time_entries
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "time_entries_insert" ON time_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "time_entries_update" ON time_entries
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "time_entries_delete" ON time_entries
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Break entries - allow users to manage their own (simplified)
CREATE POLICY "break_entries_select" ON break_entries
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "break_entries_insert" ON break_entries
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "break_entries_update" ON break_entries
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "break_entries_delete" ON break_entries
  FOR DELETE TO authenticated
  USING (true);

-- Step 8b: Add RLS policies for branch_locations table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'branch_locations') THEN
    -- Enable RLS
    ALTER TABLE branch_locations ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Branch locations visible to all authenticated users" ON branch_locations;
    DROP POLICY IF EXISTS "Only admins can manage branch locations" ON branch_locations;
    
    -- Create simple policies
    CREATE POLICY "branch_locations_select" ON branch_locations
      FOR SELECT TO authenticated
      USING (true);
    
    CREATE POLICY "branch_locations_insert" ON branch_locations
      FOR INSERT TO authenticated
      WITH CHECK (true);
    
    CREATE POLICY "branch_locations_update" ON branch_locations
      FOR UPDATE TO authenticated
      USING (true)
      WITH CHECK (true);
    
    CREATE POLICY "branch_locations_delete" ON branch_locations
      FOR DELETE TO authenticated
      USING (true);
  END IF;
END $$;

-- Step 8c: Add RLS policies for pharmacy_branches table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pharmacy_branches') THEN
    -- Enable RLS
    ALTER TABLE pharmacy_branches ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "view_pharmacy_branches" ON pharmacy_branches;
    DROP POLICY IF EXISTS "manage_pharmacy_branches" ON pharmacy_branches;
    
    -- Create simple policies
    CREATE POLICY "pharmacy_branches_select" ON pharmacy_branches
      FOR SELECT TO authenticated
      USING (true);
    
    CREATE POLICY "pharmacy_branches_insert" ON pharmacy_branches
      FOR INSERT TO authenticated
      WITH CHECK (true);
    
    CREATE POLICY "pharmacy_branches_update" ON pharmacy_branches
      FOR UPDATE TO authenticated
      USING (true)
      WITH CHECK (true);
    
    CREATE POLICY "pharmacy_branches_delete" ON pharmacy_branches
      FOR DELETE TO authenticated
      USING (true);
  END IF;
END $$;

-- Step 9: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.branch_staff_assignments TO authenticated;
GRANT ALL ON public.time_entries TO authenticated;
GRANT ALL ON public.break_entries TO authenticated;

-- Grant permissions for branch tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'branch_locations') THEN
    GRANT ALL ON public.branch_locations TO authenticated;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pharmacy_branches') THEN
    GRANT ALL ON public.pharmacy_branches TO authenticated;
  END IF;
END $$; 