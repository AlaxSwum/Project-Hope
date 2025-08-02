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

// Export the main client
export default supabase