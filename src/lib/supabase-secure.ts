import { createClient } from '@supabase/supabase-js'

// Environment variables with better error handling
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Validate required environment variables
if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}
if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

// Create a singleton instance to prevent multiple clients
let supabaseInstance: any = null

export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  }
  return supabaseInstance
})()

// Types for our user data
export interface UserData {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
  username: string
  role: string
  position?: string
}

export interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string
  username: string
  role: string
  position?: string
  created_at: string
  updated_at: string
}

export interface TimeEntry {
  id: string
  user_id: string
  branch_id: string
  clock_in_time: string
  clock_out_time?: string
  break_duration?: number
  total_hours?: number
  notes?: string
  created_at?: string
  updated_at?: string
  clock_in_latitude?: number;
  clock_in_longitude?: number;
  clock_out_latitude?: number;
  clock_out_longitude?: number;
  pay_rate?: number;
  branch?: BranchLocation;
}

export interface BranchLocation {
  id: string
  branch_id: string
  latitude: number
  longitude: number
  address: string
  radius_meters: number
  created_at?: string
  updated_at?: string
}

export interface Checklist {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

export interface ChecklistItem {
  id: string
  checklist_id: string
  title: string
  description: string
  order_number: number
  is_required: boolean
  created_at: string
  updated_at: string
  checklist?: Checklist
  user?: any
}

// Authentication functions
export const authService = {
  // Admin creates new user (via API endpoint)
  async createUser(userData: UserData) {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        return { data: null, error: result.error };
      }
      
      return { data: result.data, error: null };
    } catch (error) {
      console.error('Create user error:', error);
      return { data: null, error: { message: 'Failed to create user' } };
    }
  },

  // Sign in user
  async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        console.error('Sign in error:', error);
        return { data: null, error };
      }
      
      // After successful login, ensure user exists in users table
      if (data.user) {
        try {
          // Try to sync user to users table if not exists
          const { error: syncError } = await supabase
            .from('users')
            .upsert({
              id: data.user.id,
              email: data.user.email,
              username: data.user.user_metadata?.username || data.user.email,
              first_name: data.user.user_metadata?.first_name || data.user.email?.split('@')[0] || 'User',
              last_name: data.user.user_metadata?.last_name || '',
              role: data.user.user_metadata?.role || 'staff'
            }, { onConflict: 'id' });
          
          if (syncError) {
            console.warn('User sync warning:', syncError);
            // Don't fail login for sync errors
          }
        } catch (syncError) {
          console.warn('User sync failed:', syncError);
          // Don't fail login for sync errors
        }
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Login error:', error);
      return { data: null, error: { message: 'Login failed. Please try again.' } };
    }
  },

  // Sign out user
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current user
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // Check if user is admin (simplified to avoid database errors)
  async isAdmin() {
    try {
      const user = await this.getCurrentUser();
      if (!user) return false;
      
      // First try to get from user metadata (fast)
      if (user.user_metadata?.role === 'administrator') {
        return true;
      }
      
      // Fallback to database check with regular client
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.warn('Role check error:', error);
        return false; // Fail safe
      }
      
      return data?.role === 'administrator';
    } catch (error) {
      console.error('Admin check error:', error);
      return false;
    }
  },

  // Check if user has specific role (simplified)
  async hasRole(role: string) {
    try {
      const user = await this.getCurrentUser();
      if (!user) return false;
      
      // First try to get from user metadata
      if (user.user_metadata?.role === role) {
        return true;
      }
      
      // Fallback to database check
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.warn('Role check error:', error);
        return false;
      }
      
      return data?.role === role;
    } catch (error) {
      console.error('Role check error:', error);
      return false;
    }
  },

  // Get current user with database info
  async getCurrentUserWithProfile() {
    const user = await this.getCurrentUser();
    if (!user) return null;

    try {
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.warn('Profile fetch error:', error);
        return { user, profile: null };
      }

      return { user, profile };
    } catch (error) {
      console.error('Get user profile error:', error);
      return { user, profile: null };
    }
  },
}

// Database functions for users
export const userService = {
  // Get all users from database (via API endpoint)
  async getAllUsers() {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        return { data: null, error: result.error };
      }
      
      return { data: result.data, error: null };
    } catch (error) {
      console.error('Get all users error:', error);
      return { data: null, error: { message: 'Failed to fetch users' } };
    }
  },

  // Get user by ID
  async getUserById(id: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      
      return { data, error };
    } catch (error) {
      console.error('Get user by ID error:', error);
      return { data: null, error: { message: 'Failed to fetch user' } };
    }
  },

  // Update user profile
  async updateUser(id: string, updates: Partial<UserProfile>) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      return { data, error };
    } catch (error) {
      console.error('Update user error:', error);
      return { data: null, error: { message: 'Failed to update user' } };
    }
  },

  // Update last login time
  async updateLastLogin(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);
      
      return { data, error };
    } catch (error) {
      console.error('Update last login error:', error);
      return { data: null, error: { message: 'Failed to update last login' } };
    }
  },

  // Delete user (via API endpoint)
  async deleteUser(userId: string) {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        return { data: null, error: result.error };
      }
      
      return { data: result.data, error: null };
    } catch (error) {
      console.error('Delete user error:', error);
      return { data: null, error: { message: 'Failed to delete user' } };
    }
  },
}

// Real-time functions (for subscriptions)
export const realtimeService = {
  // Subscribe to checklist updates
  subscribeToChecklists(callback: (payload: any) => void) {
    return supabase
      .channel('checklists')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklists' }, callback)
      .subscribe();
  },

  // Subscribe to checklist item updates
  subscribeToChecklistItems(callback: (payload: any) => void) {
    return supabase
      .channel('checklist_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items' }, callback)
      .subscribe();
  },

  // Subscribe to user progress updates
  subscribeToUserProgress(callback: (payload: any) => void) {
    return supabase
      .channel('user_progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_progress' }, callback)
      .subscribe();
  },

  // Unsubscribe from a channel
  unsubscribe(subscription: any) {
    return supabase.removeChannel(subscription);
  }
}

// Time Tracking Service
export const timeTrackingService = {
  async getTimeEntries(userId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('clock_in_time', startDate)
      .lte('clock_in_time', endDate);
    return { data, error };
  },

  async getActiveStaff(branchId: string) {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*, user_profiles(*)')
      .eq('branch_id', branchId)
      .is('clock_out_time', null);
    return { data, error };
  },

  async getStaffOnBreak(branchId: string) {
    // Breaks table doesn't exist - return empty data to prevent 404 errors
    console.log('⚠️ Breaks functionality not available (table does not exist)');
    return { data: [], error: null };
  },

  async calculateScheduledHours(userId: string, startDate: string, endDate: string) {
    // Basic implementation
    return { totalHours: 0, entries: [] };
  },

  async getAllTimeEntries(startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .gte('clock_in_time', startDate)
      .lte('clock_in_time', endDate);
    return { data, error };
  },

  async getEmployeeSchedule(userId: string) {
    const { data, error } = await supabase
      .from('employee_schedules')
      .select('*')
      .eq('user_id', userId);
    return { data, error };
  },

  async getBranchLocation(branchId: string) {
    const { data, error } = await supabase
      .from('branch_locations')
      .select('*')
      .eq('branch_id', branchId)
      .single();
    return { data, error };
  },

  async updateEmployeeSchedule(scheduleId: string, formData: any) {
    const { data, error } = await supabase
      .from('employee_schedules')
      .update(formData)
      .eq('id', scheduleId);
    return { data, error };
  },

  async createEmployeeSchedule(scheduleData: any) {
    const { data, error } = await supabase
      .from('employee_schedules')
      .insert(scheduleData);
    return { data, error };
  },

  async getBranchTimeEntries(branchId: string, date: string) {
    let query = supabase
      .from('time_entries')
      .select('*, user_profiles(*)')
      .eq('branch_id', branchId);
    
    if (date) {
      query = query.gte('clock_in_time', date).lt('clock_in_time', date + 'T23:59:59');
    }
    
    const { data, error } = await query;
    return { data, error };
  },

  async endBreak(breakId: string) {
    // Breaks table doesn't exist - return success to prevent 404 errors
    console.log('⚠️ Breaks functionality not available (table does not exist)');
    return { data: null, error: { message: 'Break functionality is not available' } };
  },

  async startBreak(breakData: any) {
    // Breaks table doesn't exist - return success to prevent 404 errors
    console.log('⚠️ Breaks functionality not available (table does not exist)');
    return { data: null, error: { message: 'Break functionality is not available' } };
  },

  async getCurrentTimeEntry(userId: string) {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*, branch:pharmacy_branches(branch_name)')
      .eq('user_id', userId)
      .is('clock_out_time', null)
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { data, error };
  },

  async getActiveBreak(timeEntryId: string) {
    // Breaks table doesn't exist - return null to prevent 404 errors
    console.log('⚠️ Breaks functionality not available (table does not exist)');
    return { data: null, error: null };
  },

  async clockIn(clockInData: any) {
    const { data, error } = await supabase
      .from('time_entries')
      .insert(clockInData);
    return { data, error };
  },

  async clockOut(timeEntryId: string, clockOutData: any) {
    const { data, error } = await supabase
      .from('time_entries')
      .update({ clock_out_time: new Date().toISOString(), ...clockOutData })
      .eq('id', timeEntryId);
    return { data, error };
  },

  async updateBranchLocation(locationId: string, locationData: any) {
    const { data, error } = await supabase
      .from('branch_locations')
      .update(locationData)
      .eq('id', locationId);
    return { data, error };
  },

  async createBranchLocation(locationData: any) {
    const { data, error } = await supabase
      .from('branch_locations')
      .insert(locationData);
    return { data, error };
  }
};

// Checklist Service
export const checklistService = {
  async getChecklistsForUser(userId: string) {
    const { data, error } = await supabase
      .from('checklists')
      .select('*')
      .eq('assigned_to', userId);
    return { data, error };
  },

  async getUserProgress(userId: string) {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId);
    return { data, error };
  },

  async getDailyStatus(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .gte('completed_at', today)
      .lt('completed_at', today + 'T23:59:59');
    return { data, error };
  },

  async getChecklistItems(checklistId: string) {
    const { data, error } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('checklist_id', checklistId)
      .order('order_index');
    return { data, error };
  },

  async updateItemProgress(progressData: any) {
    const { error } = await supabase
      .from('user_progress')
      .upsert(progressData);
    return { error };
  },

  async getFolders(branchId: string) {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('branch_id', branchId);
    return { data, error };
  },

  async getChecklists(folderId: string) {
    const { data, error } = await supabase
      .from('checklists')
      .select('*')
      .eq('folder_id', folderId);
    return { data, error };
  },

  async deleteFolder(folderId: string) {
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);
    return { error };
  },

  async deleteChecklist(checklistId: string) {
    const { error } = await supabase
      .from('checklists')
      .delete()
      .eq('id', checklistId);
    return { error };
  },

  async getAllUsersProgress(date: string) {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*, user_profiles(*), checklist_items(*)')
      .gte('completed_at', date)
      .lt('completed_at', date + 'T23:59:59');
    return { data, error };
  },

  async createFolder(folderData: any) {
    const { error } = await supabase
      .from('folders')
      .insert(folderData);
    return { error };
  },

  async createChecklist(checklistData: any) {
    const { error } = await supabase
      .from('checklists')
      .insert(checklistData);
    return { error };
  },

  async createChecklistItem(itemData: any) {
    const { error } = await supabase
      .from('checklist_items')
      .insert(itemData);
    return { error };
  },

  async deleteChecklistItem(itemId: string) {
    const { error } = await supabase
      .from('checklist_items')
      .delete()
      .eq('id', itemId);
    return { error };
  },

  async reorderChecklistItems(checklistId: string, items: any[]) {
    // Update order_index for each item
    const updates = items.map((item, index) => 
      supabase
        .from('checklist_items')
        .update({ order_index: index })
        .eq('id', item.id)
    );
    
    await Promise.all(updates);
    return { error: null };
  },

  async updateFolder(folderId: string, folderData: any) {
    const { error } = await supabase
      .from('folders')
      .update(folderData)
      .eq('id', folderId);
    return { error };
  },

  async updateChecklist(checklistId: string, checklistData: any) {
    const { error } = await supabase
      .from('checklists')
      .update(checklistData)
      .eq('id', checklistId);
    return { error };
  }
};

// Holiday Service
export const holidayService = {
  async getHolidays(branchId?: string) {
    let query = supabase.from('holidays').select('*');
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    const { data, error } = await query;
    return { data, error };
  },

  async createHoliday(holidayData: any) {
    const { data, error } = await supabase
      .from('holidays')
      .insert(holidayData);
    return { data, error };
  },

  async updateHoliday(holidayId: string, holidayData: any) {
    const { error } = await supabase
      .from('holidays')
      .update(holidayData)
      .eq('id', holidayId);
    return { error };
  },

  async deleteHoliday(holidayId: string) {
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', holidayId);
    return { error };
  }
};

// Admin client (same as regular client for now - would use service role in production)
export const supabaseAdmin = supabase;

// Export the main client
export default supabase