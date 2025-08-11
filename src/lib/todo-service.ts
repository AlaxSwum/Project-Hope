import { supabase } from './supabase-secure';

export interface TodoList {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  open_tasks_count?: number;
  total_tasks_count?: number;
  can_manage?: boolean;
  can_edit?: boolean;
}

export interface TodoTask {
  id: string;
  list_id: string;
  title: string;
  description?: string;
  assigned_to?: string | null;
  assigned_to_username?: string | null;
  assigned_to_email?: string | null;
  assigned_to_first_name?: string | null;
  assigned_to_last_name?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  status: 'open' | 'in_progress' | 'done';
  priority: 'low' | 'normal' | 'high';
  sort_order?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  can_edit?: boolean;
}

export interface TodoListShare {
  id: string;
  list_id: string;
  user_id: string;
  can_edit: boolean;
  created_at: string;
}

export interface CreateListData {
  name: string;
  description?: string;
  color?: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  assigned_to?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  priority?: 'low' | 'normal' | 'high';
}

export const todoService = {
  // List management
  async getLists(): Promise<{ data: TodoList[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('todo_lists_with_details')
        .select('*')
        .order('name');

      return { data, error };
    } catch (error) {
      console.error('Error fetching todo lists:', error);
      return { data: null, error };
    }
  },

  async createList(input: CreateListData): Promise<{ data: TodoList | null; error: any }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) {
        return { data: null, error: { message: 'User not authenticated' } };
      }

      const { data, error } = await supabase
        .from('todo_lists')
        .insert([{
          ...input,
          created_by: user.user.id
        }])
        .select('*')
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error creating todo list:', error);
      return { data: null, error };
    }
  },

  async updateList(id: string, updates: Partial<CreateListData>): Promise<{ data: TodoList | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('todo_lists')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error updating todo list:', error);
      return { data: null, error };
    }
  },

  async deleteList(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('todo_lists')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error deleting todo list:', error);
      return { error };
    }
  },

  // List sharing
  async shareList(listId: string, userId: string, canEdit = false): Promise<{ data: TodoListShare | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('todo_list_shares')
        .insert([{
          list_id: listId,
          user_id: userId,
          can_edit: canEdit
        }])
        .select('*')
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error sharing todo list:', error);
      return { data: null, error };
    }
  },

  async unshareList(listId: string, userId: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('todo_list_shares')
        .delete()
        .eq('list_id', listId)
        .eq('user_id', userId);

      return { error };
    } catch (error) {
      console.error('Error unsharing todo list:', error);
      return { error };
    }
  },

  async getListShares(listId: string): Promise<{ data: TodoListShare[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('todo_list_shares')
        .select(`
          *,
          user:users(id, username, email, first_name, last_name)
        `)
        .eq('list_id', listId);

      return { data, error };
    } catch (error) {
      console.error('Error fetching list shares:', error);
      return { data: null, error };
    }
  },

  // Task management
  async getTasks(listId: string): Promise<{ data: TodoTask[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('todo_tasks_with_assignee')
        .select('*')
        .eq('list_id', listId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      return { data, error };
    } catch (error) {
      console.error('Error fetching todo tasks:', error);
      return { data: null, error };
    }
  },

  async createTask(listId: string, input: CreateTaskData): Promise<{ data: TodoTask | null; error: any }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) {
        return { data: null, error: { message: 'User not authenticated' } };
      }

      const taskData = {
        list_id: listId,
        title: input.title,
        description: input.description || null,
        assigned_to: input.assigned_to ?? user.user.id, // Default to current user
        due_date: input.due_date || null,
        due_time: input.due_time || null,
        priority: input.priority || 'normal',
        created_by: user.user.id
      };

      const { data, error } = await supabase
        .from('todo_tasks')
        .insert([taskData])
        .select('*')
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error creating todo task:', error);
      return { data: null, error };
    }
  },

  async updateTask(id: string, updates: Partial<TodoTask>): Promise<{ data: TodoTask | null; error: any }> {
    try {
      // Remove computed fields that shouldn't be updated
      const cleanUpdates = { ...updates };
      delete cleanUpdates.assigned_to_username;
      delete cleanUpdates.assigned_to_email;
      delete cleanUpdates.assigned_to_first_name;
      delete cleanUpdates.assigned_to_last_name;
      delete cleanUpdates.can_edit;
      delete cleanUpdates.created_at;
      delete cleanUpdates.updated_at;

      const { data, error } = await supabase
        .from('todo_tasks')
        .update(cleanUpdates)
        .eq('id', id)
        .select('*')
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error updating todo task:', error);
      return { data: null, error };
    }
  },

  async deleteTask(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('todo_tasks')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error deleting todo task:', error);
      return { error };
    }
  },

  // Utility functions
  async getAvailableUsers(): Promise<{ data: any[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email, first_name, last_name')
        .order('first_name', { ascending: true });

      return { data, error };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { data: null, error };
    }
  },

  async getTasksWithDueDates(startDate?: string, endDate?: string): Promise<{ data: TodoTask[] | null; error: any }> {
    try {
      let query = supabase
        .from('todo_tasks_with_assignee')
        .select('*')
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      if (startDate) {
        query = query.gte('due_date', startDate);
      }
      if (endDate) {
        query = query.lte('due_date', endDate);
      }

      const { data, error } = await query;

      return { data, error };
    } catch (error) {
      console.error('Error fetching tasks with due dates:', error);
      return { data: null, error };
    }
  }
};
