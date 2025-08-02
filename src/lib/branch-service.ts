// Branch Service for Hope Pharmacy IMS
// Real implementation with Supabase API calls
import { supabaseAdmin, authService } from './supabase-secure';

export interface BranchData {
  branch_name: string;
  branch_code: string;
  address: string;
  city: string;
  state?: string;
  postcode: string;
  country?: string;
  phone_number?: string;
  email?: string;
  branch_type?: string;
  pharmacy_license_number?: string;
  notes?: string;
}

export interface Branch {
  id: string;
  branch_name: string;
  branch_code: string;
  address: string;
  city: string;
  state?: string;
  postcode: string;
  country?: string;
  phone_number?: string;
  email?: string;
  branch_type?: string;
  pharmacy_license_number?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface UserBranchAssignment {
  id: string;
  branch_id: string;
  user_id: string;
  position?: string;
  assignment_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const branchService = {
  // Get all branches
  getAllBranches: async () => {
    try {
      // Get branches first
      const { data: branches, error } = await supabaseAdmin
        .from('pharmacy_branches')
        .select('*')
        .eq('is_active', true)
        .order('branch_name');

      if (error) return { data: null, error };

      // Get staff counts for each branch
      const branchesWithStaffCount = await Promise.all(
        (branches || []).map(async (branch: any) => {
          const { count } = await supabaseAdmin
            .from('user_branch_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', branch.id)
            .eq('is_active', true);
          
          return {
            ...branch,
            staff_count: count || 0
          };
        })
      );

      const data = branchesWithStaffCount;
      
      return { data, error };
    } catch (error) {
      console.error('Error fetching branches:', error);
      return { 
        data: null, 
        error: { message: 'Failed to fetch branches' } 
      };
    }
  },

  // Create a new branch
  createBranch: async (branchData: BranchData) => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        return { 
          data: null,
          error: { message: 'User not authenticated' } 
        };
      }

      const { data, error } = await supabaseAdmin
        .from('pharmacy_branches')
        .insert([{
          ...branchData,
          created_by: user.id,
          is_active: true
        }])
        .select()
        .single();
      
      console.log('Branch created successfully:', data);
      return { data, error };
    } catch (error) {
      console.error('Error creating branch:', error);
      return { 
        data: null,
        error: { message: 'Failed to create branch' } 
      };
    }
  },

  // Update an existing branch
  updateBranch: async (branchId: string, branchData: Partial<BranchData>) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('pharmacy_branches')
        .update({
          ...branchData,
          updated_at: new Date().toISOString()
        })
        .eq('id', branchId)
        .select()
        .single();
      
      console.log('Branch updated successfully:', data);
      return { data, error };
    } catch (error) {
      console.error('Error updating branch:', error);
      return { 
        data: null,
        error: { message: 'Failed to update branch' } 
      };
    }
  },

  // Delete a branch (soft delete)
  deleteBranch: async (branchId: string) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('pharmacy_branches')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', branchId)
        .select()
        .single();
      
      console.log('Branch deleted successfully:', data);
      return { data, error };
    } catch (error) {
      console.error('Error deleting branch:', error);
      return { 
        data: null,
        error: { message: 'Failed to delete branch' } 
      };
    }
  },

  // Assign a user to a branch
  assignUserToBranch: async (branchId: string, userId: string, position?: string, workSchedule?: any) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('branch_staff_assignments')
        .insert([{
          branch_id: branchId,
          user_id: userId,
          position: position,
          work_schedule: workSchedule,
          assignment_date: new Date().toISOString().split('T')[0],
          is_primary_branch: false
        }])
        .select(`
          *,
          user:users!user_id(id, first_name, last_name, email, role),
          branch:pharmacy_branches!branch_id(id, branch_name, branch_code)
        `)
        .single();
      
      console.log('User assigned to branch successfully:', data);
      return { data, error };
    } catch (error) {
      console.error('Error assigning user to branch:', error);
      return { 
        data: null,
        error: { message: 'Failed to assign user to branch' } 
      };
    }
  },

  // Update staff schedule
  updateStaffSchedule: async (branchId: string, userId: string, workSchedule: any) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('branch_staff_assignments')
        .update({ 
          work_schedule: workSchedule,
          updated_at: new Date().toISOString()
        })
        .eq('branch_id', branchId)
        .eq('user_id', userId)
        .select()
        .single();
      
      console.log('Staff schedule updated successfully:', data);
      return { data, error };
    } catch (error) {
      console.error('Error updating staff schedule:', error);
      return { 
        data: null,
        error: { message: 'Failed to update staff schedule' } 
      };
    }
  },

  // Remove user from branch
  removeUserFromBranch: async (branchId: string, userId: string) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('branch_staff_assignments')
        .delete()
        .eq('branch_id', branchId)
        .eq('user_id', userId)
        .select()
        .single();
      
      console.log('User removed from branch successfully:', data);
      return { data, error };
    } catch (error) {
      console.error('Error removing user from branch:', error);
      return { 
        data: null,
        error: { message: 'Failed to remove user from branch' } 
      };
    }
  },

  // Get branch staff
  getBranchStaff: async (branchId: string) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('branch_staff_assignments')
        .select(`
          *,
          user:users!user_id(
            id,
            first_name,
            last_name,
            email,
            role,
            position,
            phone
          )
        `)
        .eq('branch_id', branchId)
        .order('assignment_date', { ascending: false });
      
      return { data, error };
    } catch (error) {
      console.error('Error fetching branch staff:', error);
      return { 
        data: null, 
        error: { message: 'Failed to fetch branch staff' } 
      };
    }
  },

  // Get all users not assigned to a specific branch
  getAvailableUsersForBranch: async (branchId: string) => {
    try {
      // Get all users
      const { data: allUsers, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, first_name, last_name, email, role, position')
        .order('first_name');

      if (usersError) {
        return { data: null, error: usersError };
      }

      // Get users already assigned to this branch
      const { data: assignedUsers, error: assignedError } = await supabaseAdmin
        .from('branch_staff_assignments')
        .select('user_id')
        .eq('branch_id', branchId);

      if (assignedError) {
        return { data: null, error: assignedError };
      }

      // Filter out already assigned users
      const assignedUserIds = new Set(assignedUsers?.map((a: any) => a.user_id) || []);
      const availableUsers = allUsers?.filter((user: any) => !assignedUserIds.has(user.id)) || [];

      return { data: availableUsers, error: null };
    } catch (error) {
      console.error('Error fetching available users:', error);
      return { 
        data: null, 
        error: { message: 'Failed to fetch available users' } 
      };
    }
  },

  // Get branch performance metrics
  getBranchPerformance: async (branchId: string, dateFor?: string) => {
    try {
      const targetDate = dateFor || new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabaseAdmin
        .rpc('get_branch_performance_summary', {
          branch_uuid: branchId,
          date_for: targetDate
        });
      
      return { data, error };
    } catch (error) {
      console.error('Error fetching branch performance:', error);
      return { 
        data: {
          total_staff: 0,
          total_checklists: 0,
          average_completion: 0,
          active_folders: 0
        }, 
        error: { message: 'Failed to fetch branch performance' }
      };
    }
  },

  // Get user's branches
  getUserBranches: async (userId: string) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('branch_staff_assignments')
        .select(`
          *,
          branch:pharmacy_branches!branch_id(*)
        `)
        .eq('user_id', userId)
        .order('assignment_date', { ascending: false });
      
      return { data, error };
    } catch (error) {
      console.error('Error fetching user branches:', error);
      return { 
        data: null, 
        error: { message: 'Failed to fetch user branches' } 
      };
    }
  },

  // Get branch by ID
  getBranchById: async (branchId: string) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('pharmacy_branches')
        .select('*')
        .eq('id', branchId)
        .eq('is_active', true)
        .single();
      
      return { data, error };
    } catch (error) {
      console.error('Error fetching branch:', error);
      return { 
        data: null, 
        error: { message: 'Failed to fetch branch' } 
      };
    }
  }
}; 