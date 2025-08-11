-- todo-schema.sql
-- To-Do Lists Feature Database Schema
-- Run this in Supabase SQL Editor

-- Create todo_lists table
CREATE TABLE IF NOT EXISTS todo_lists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366F1',
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create todo_list_shares table for sharing lists with team members
CREATE TABLE IF NOT EXISTS todo_list_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    list_id UUID NOT NULL REFERENCES todo_lists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    can_edit BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(list_id, user_id)
);

-- Create todo_tasks table
CREATE TABLE IF NOT EXISTS todo_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    list_id UUID NOT NULL REFERENCES todo_lists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES auth.users(id),
    due_date DATE,
    due_time TIME,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    sort_order INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_todo_lists_created_by ON todo_lists(created_by);
CREATE INDEX IF NOT EXISTS idx_todo_lists_active ON todo_lists(is_active);
CREATE INDEX IF NOT EXISTS idx_todo_list_shares_list ON todo_list_shares(list_id);
CREATE INDEX IF NOT EXISTS idx_todo_list_shares_user ON todo_list_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_list ON todo_tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_assigned_to ON todo_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_status ON todo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_due_date ON todo_tasks(due_date);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_todo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at fields
DROP TRIGGER IF EXISTS trigger_todo_lists_updated_at ON todo_lists;
CREATE TRIGGER trigger_todo_lists_updated_at
    BEFORE UPDATE ON todo_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_todo_updated_at();

DROP TRIGGER IF EXISTS trigger_todo_tasks_updated_at ON todo_tasks;
CREATE TRIGGER trigger_todo_tasks_updated_at
    BEFORE UPDATE ON todo_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_todo_updated_at();

-- Enable Row Level Security
ALTER TABLE todo_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_list_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for todo_lists
-- Users can read lists they own or are shared with
DROP POLICY IF EXISTS "Users can read accessible todo lists" ON todo_lists;
CREATE POLICY "Users can read accessible todo lists" ON todo_lists
    FOR SELECT USING (
        created_by = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM todo_list_shares 
            WHERE list_id = todo_lists.id AND user_id = auth.uid()
        )
    );

-- Users can insert their own lists
DROP POLICY IF EXISTS "Users can create todo lists" ON todo_lists;
CREATE POLICY "Users can create todo lists" ON todo_lists
    FOR INSERT WITH CHECK (created_by = auth.uid());

-- Users can update lists they own
DROP POLICY IF EXISTS "Users can update their todo lists" ON todo_lists;
CREATE POLICY "Users can update their todo lists" ON todo_lists
    FOR UPDATE USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Users can delete lists they own
DROP POLICY IF EXISTS "Users can delete their todo lists" ON todo_lists;
CREATE POLICY "Users can delete their todo lists" ON todo_lists
    FOR DELETE USING (created_by = auth.uid());

-- RLS Policies for todo_list_shares
-- List owners can manage shares
DROP POLICY IF EXISTS "List owners can manage shares" ON todo_list_shares;
CREATE POLICY "List owners can manage shares" ON todo_list_shares
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM todo_lists 
            WHERE id = todo_list_shares.list_id AND created_by = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM todo_lists 
            WHERE id = todo_list_shares.list_id AND created_by = auth.uid()
        )
    );

-- Users can read shares they're part of
DROP POLICY IF EXISTS "Users can read their shares" ON todo_list_shares;
CREATE POLICY "Users can read their shares" ON todo_list_shares
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM todo_lists 
            WHERE id = todo_list_shares.list_id AND created_by = auth.uid()
        )
    );

-- RLS Policies for todo_tasks
-- Users can read tasks from accessible lists
DROP POLICY IF EXISTS "Users can read accessible todo tasks" ON todo_tasks;
CREATE POLICY "Users can read accessible todo tasks" ON todo_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM todo_lists 
            WHERE id = todo_tasks.list_id AND created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM todo_list_shares 
            WHERE list_id = todo_tasks.list_id AND user_id = auth.uid()
        )
    );

-- Users can insert tasks if they own the list or have edit permission
DROP POLICY IF EXISTS "Users can create tasks in accessible lists" ON todo_tasks;
CREATE POLICY "Users can create tasks in accessible lists" ON todo_tasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM todo_lists 
            WHERE id = todo_tasks.list_id AND created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM todo_list_shares 
            WHERE list_id = todo_tasks.list_id AND user_id = auth.uid() AND can_edit = true
        )
    );

-- Users can update tasks if they own the list or have edit permission
DROP POLICY IF EXISTS "Users can update tasks in accessible lists" ON todo_tasks;
CREATE POLICY "Users can update tasks in accessible lists" ON todo_tasks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM todo_lists 
            WHERE id = todo_tasks.list_id AND created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM todo_list_shares 
            WHERE list_id = todo_tasks.list_id AND user_id = auth.uid() AND can_edit = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM todo_lists 
            WHERE id = todo_tasks.list_id AND created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM todo_list_shares 
            WHERE list_id = todo_tasks.list_id AND user_id = auth.uid() AND can_edit = true
        )
    );

-- Users can delete tasks if they own the list or have edit permission
DROP POLICY IF EXISTS "Users can delete tasks in accessible lists" ON todo_tasks;
CREATE POLICY "Users can delete tasks in accessible lists" ON todo_tasks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM todo_lists 
            WHERE id = todo_tasks.list_id AND created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM todo_list_shares 
            WHERE list_id = todo_tasks.list_id AND user_id = auth.uid() AND can_edit = true
        )
    );

-- Create helpful views for the UI
CREATE OR REPLACE VIEW todo_lists_with_details AS
SELECT 
    l.*,
    (SELECT COUNT(*) FROM todo_tasks t WHERE t.list_id = l.id AND t.status != 'done') as open_tasks_count,
    (SELECT COUNT(*) FROM todo_tasks t WHERE t.list_id = l.id) as total_tasks_count,
    CASE 
        WHEN l.created_by = auth.uid() THEN true
        ELSE false
    END as can_manage,
    CASE 
        WHEN l.created_by = auth.uid() THEN true
        WHEN EXISTS (SELECT 1 FROM todo_list_shares s WHERE s.list_id = l.id AND s.user_id = auth.uid() AND s.can_edit = true) THEN true
        ELSE false
    END as can_edit
FROM todo_lists l
WHERE l.is_active = true;

CREATE OR REPLACE VIEW todo_tasks_with_assignee AS
SELECT 
    t.*,
    u.username as assigned_to_username,
    u.email as assigned_to_email,
    u.first_name as assigned_to_first_name,
    u.last_name as assigned_to_last_name,
    CASE 
        WHEN tl.created_by = auth.uid() THEN true
        WHEN EXISTS (SELECT 1 FROM todo_list_shares s WHERE s.list_id = t.list_id AND s.user_id = auth.uid() AND s.can_edit = true) THEN true
        ELSE false
    END as can_edit
FROM todo_tasks t
LEFT JOIN users u ON u.id = t.assigned_to
LEFT JOIN todo_lists tl ON tl.id = t.list_id;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON todo_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON todo_list_shares TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON todo_tasks TO authenticated;
GRANT SELECT ON todo_lists_with_details TO authenticated;
GRANT SELECT ON todo_tasks_with_assignee TO authenticated;

-- Insert a default "Personal" list for existing users
INSERT INTO todo_lists (name, description, color, created_by)
SELECT 
    'Personal', 
    'Personal tasks and reminders', 
    '#6366F1',
    id
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM todo_lists WHERE created_by = auth.users.id
)
ON CONFLICT DO NOTHING;

COMMIT;
