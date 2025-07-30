import React, { useState, useEffect } from 'react';
import { supabase, timeTrackingService } from '../lib/supabase';
import { toast } from 'react-toastify';

interface AssignStaffModalProps {
  branchId: string;
  onClose: () => void;
  onStaffChanged?: () => void; // Add callback for when staff assignments change
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface StaffAssignment {
  id: string;
  user_id: string;
  position: string;
  work_schedule: {
    [day: string]: { start: string; end: string; };
  };
  is_primary_branch: boolean;
  assignment_date: string;
  user: User;
  pay_rate?: number;
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function AssignStaffModal({ branchId, onClose, onStaffChanged }: AssignStaffModalProps) {
  const [assignedStaff, setAssignedStaff] = useState<StaffAssignment[]>([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<{ [key: string]: { start: string; end: string; workDay: boolean } }>({});
  const [editingPayRate, setEditingPayRate] = useState<string | null>(null);
  const [tempPayRate, setTempPayRate] = useState<string>('');

  // Initialize empty schedule for all days
  const initializeSchedule = () => {
    const newSchedule: { [key: string]: { start: string; end: string; workDay: boolean } } = {};
    DAYS_OF_WEEK.forEach(day => {
      // Default: Monday-Friday are work days, weekends are off
      const isWorkDay = !['saturday', 'sunday'].includes(day);
      newSchedule[day] = { 
        start: '09:00', 
        end: '17:00',
        workDay: isWorkDay
      };
    });
    return newSchedule;
  };

  useEffect(() => {
    loadAssignedStaff();
  }, [branchId]);

  const loadAssignedStaff = async () => {
    try {
      setLoading(true);
      console.log('Loading assigned staff for branch:', branchId);
      
      const { data: assignments, error } = await supabase
        .from('branch_staff_assignments')
        .select(`
          *,
          user:users(*)
        `)
        .eq('branch_id', branchId);

      if (error) {
        console.error('Error loading assignments:', error);
        throw error;
      }

      // Load schedules for each assignment
      const assignmentsWithSchedules = await Promise.all(
        (assignments || []).map(async (assignment) => {
          try {
            const { data: schedule } = await supabase
              .from('employee_schedules')
              .select('*')
              .eq('user_id', assignment.user_id)
              .eq('branch_id', branchId)
              .single();

            if (schedule) {
                             // Convert employee_schedules format to the expected work_schedule format
               const work_schedule = {
                 monday: { 
                   start: schedule.monday_start || '09:00', 
                   end: schedule.monday_end || '17:00',
                   workDay: !!(schedule.monday_start && schedule.monday_end)
                 },
                 tuesday: { 
                   start: schedule.tuesday_start || '09:00', 
                   end: schedule.tuesday_end || '17:00',
                   workDay: !!(schedule.tuesday_start && schedule.tuesday_end)
                 },
                 wednesday: { 
                   start: schedule.wednesday_start || '09:00', 
                   end: schedule.wednesday_end || '17:00',
                   workDay: !!(schedule.wednesday_start && schedule.wednesday_end)
                 },
                 thursday: { 
                   start: schedule.thursday_start || '09:00', 
                   end: schedule.thursday_end || '17:00',
                   workDay: !!(schedule.thursday_start && schedule.thursday_end)
                 },
                 friday: { 
                   start: schedule.friday_start || '09:00', 
                   end: schedule.friday_end || '17:00',
                   workDay: !!(schedule.friday_start && schedule.friday_end)
                 },
                 saturday: { 
                   start: schedule.saturday_start || '09:00', 
                   end: schedule.saturday_end || '17:00',
                   workDay: !!(schedule.saturday_start && schedule.saturday_end)
                 },
                 sunday: { 
                   start: schedule.sunday_start || '09:00', 
                   end: schedule.sunday_end || '17:00',
                   workDay: !!(schedule.sunday_start && schedule.sunday_end)
                 }
               };
              return { ...assignment, work_schedule };
            }
            return assignment;
          } catch (scheduleError) {
            console.warn(`No schedule found for user ${assignment.user_id}:`, scheduleError);
            return assignment;
          }
        })
      );

      console.log('Assignments with schedules loaded:', assignmentsWithSchedules);
      setAssignedStaff(assignmentsWithSchedules);
    } catch (error) {
      console.error('Error loading assigned staff:', error);
      toast.error(`Failed to load assigned staff: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const assignedUserIds = (assignedStaff || []).map(a => a.user_id);
      
      let query = supabase.from('users').select('*');
      
      if (assignedUserIds.length > 0) {
        query = query.not('id', 'in', `(${assignedUserIds.join(',')})`);
      }
      
      const { data: users, error } = await query;

      if (error) throw error;
      setAvailableUsers(users || []);
    } catch (error) {
      console.error('Error loading available users:', error);
      toast.error('Failed to load available users');
    }
  };

  const handleAddStaffClick = async () => {
    await loadAvailableUsers();
    setShowAddStaff(true);
  };

  const handleAssignStaff = async (userId: string) => {
    try {
      console.log('Assigning staff:', userId, 'to branch:', branchId);
      
      // First, create the staff assignment
      const { data, error } = await supabase
        .from('branch_staff_assignments')
        .insert({
          user_id: userId,
          branch_id: branchId,
          is_primary_branch: false,
          position: 'staff',
          pay_rate: 12.00 // Set default pay rate
        })
        .select();

      if (error) {
        console.error('Assignment error:', error);
        throw error;
      }

      // Then create default schedule in employee_schedules table
      // Default: Monday-Friday 9AM-5PM, weekends off
      const defaultScheduleData = {
        user_id: userId,
        branch_id: branchId,
        monday_start: '09:00',
        monday_end: '17:00',
        tuesday_start: '09:00',
        tuesday_end: '17:00',
        wednesday_start: '09:00',
        wednesday_end: '17:00',
        thursday_start: '09:00',
        thursday_end: '17:00',
        friday_start: '09:00',
        friday_end: '17:00',
        saturday_start: null, // No work on Saturday
        saturday_end: null,
        sunday_start: null, // No work on Sunday
        sunday_end: null,
        is_active: true
      };

      const scheduleResult = await supabase
        .from('employee_schedules')
        .insert([defaultScheduleData])
        .select();
        
      if (scheduleResult.error) {
        console.error('Schedule creation error:', scheduleResult.error);
        // Don't throw error for schedule - assignment is still valid
        console.warn('Staff assigned but default schedule creation failed');
      }

      console.log('Assignment result:', data);
      toast.success('Staff assigned successfully with default schedule');
      await loadAssignedStaff();
      onStaffChanged?.(); // Trigger refresh in parent
      setShowAddStaff(false);
    } catch (error) {
      console.error('Error assigning staff:', error);
      toast.error(`Failed to assign staff: ${error.message}`);
    }
  };

  const handleRemoveStaff = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('branch_staff_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
      toast.success('Staff removed successfully');
      await loadAssignedStaff();
      onStaffChanged?.(); // Trigger refresh in parent
    } catch (error) {
      console.error('Error removing staff:', error);
      toast.error('Failed to remove staff');
    }
  };

  const handleSetSchedule = async (assignmentId: string, userId: string) => {
    setSelectedUserId(userId);
    
    try {
      // Load existing schedule from employee_schedules table
      const { data: existingSchedule } = await supabase
        .from('employee_schedules')
        .select('*')
        .eq('user_id', userId)
        .eq('branch_id', branchId)
        .single();

      if (existingSchedule) {
        // Convert employee_schedules format to component format
        const convertedSchedule = {
          monday: { 
            start: existingSchedule.monday_start || '09:00', 
            end: existingSchedule.monday_end || '17:00',
            workDay: !!(existingSchedule.monday_start && existingSchedule.monday_end)
          },
          tuesday: { 
            start: existingSchedule.tuesday_start || '09:00', 
            end: existingSchedule.tuesday_end || '17:00',
            workDay: !!(existingSchedule.tuesday_start && existingSchedule.tuesday_end)
          },
          wednesday: { 
            start: existingSchedule.wednesday_start || '09:00', 
            end: existingSchedule.wednesday_end || '17:00',
            workDay: !!(existingSchedule.wednesday_start && existingSchedule.wednesday_end)
          },
          thursday: { 
            start: existingSchedule.thursday_start || '09:00', 
            end: existingSchedule.thursday_end || '17:00',
            workDay: !!(existingSchedule.thursday_start && existingSchedule.thursday_end)
          },
          friday: { 
            start: existingSchedule.friday_start || '09:00', 
            end: existingSchedule.friday_end || '17:00',
            workDay: !!(existingSchedule.friday_start && existingSchedule.friday_end)
          },
          saturday: { 
            start: existingSchedule.saturday_start || '09:00', 
            end: existingSchedule.saturday_end || '17:00',
            workDay: !!(existingSchedule.saturday_start && existingSchedule.saturday_end)
          },
          sunday: { 
            start: existingSchedule.sunday_start || '09:00', 
            end: existingSchedule.sunday_end || '17:00',
            workDay: !!(existingSchedule.sunday_start && existingSchedule.sunday_end)
          }
        };
        setSchedule(convertedSchedule);
      } else {
        // Use default schedule
        setSchedule(initializeSchedule());
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      // Fallback to default schedule
      setSchedule(initializeSchedule());
    }
    
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    if (!selectedUserId) return;

    try {
      console.log('Saving schedule for user:', selectedUserId, 'branch:', branchId);
      console.log('Schedule data:', schedule);
      
      // Convert schedule format to employee_schedules table format
      // Only save times for work days, null for non-work days
      const scheduleData = {
        user_id: selectedUserId,
        branch_id: branchId,
        monday_start: schedule.monday?.workDay ? schedule.monday.start : null,
        monday_end: schedule.monday?.workDay ? schedule.monday.end : null,
        tuesday_start: schedule.tuesday?.workDay ? schedule.tuesday.start : null,
        tuesday_end: schedule.tuesday?.workDay ? schedule.tuesday.end : null,
        wednesday_start: schedule.wednesday?.workDay ? schedule.wednesday.start : null,
        wednesday_end: schedule.wednesday?.workDay ? schedule.wednesday.end : null,
        thursday_start: schedule.thursday?.workDay ? schedule.thursday.start : null,
        thursday_end: schedule.thursday?.workDay ? schedule.thursday.end : null,
        friday_start: schedule.friday?.workDay ? schedule.friday.start : null,
        friday_end: schedule.friday?.workDay ? schedule.friday.end : null,
        saturday_start: schedule.saturday?.workDay ? schedule.saturday.start : null,
        saturday_end: schedule.saturday?.workDay ? schedule.saturday.end : null,
        sunday_start: schedule.sunday?.workDay ? schedule.sunday.start : null,
        sunday_end: schedule.sunday?.workDay ? schedule.sunday.end : null,
        is_active: true
      };

      // First, try to update existing schedule
      const { data: existingSchedule, error: checkError } = await supabase
        .from('employee_schedules')
        .select('id')
        .eq('user_id', selectedUserId)
        .eq('branch_id', branchId)
        .single();

      let result;
      if (existingSchedule && !checkError) {
        // Update existing schedule
        result = await supabase
          .from('employee_schedules')
          .update(scheduleData)
          .eq('id', existingSchedule.id)
          .select();
      } else {
        // Create new schedule
        result = await supabase
          .from('employee_schedules')
          .insert([scheduleData])
          .select();
      }

      if (result.error) {
        console.error('Schedule save error:', result.error);
        throw result.error;
      }
      
      console.log('Schedule save result:', result.data);
      toast.success('Schedule updated successfully');
      await loadAssignedStaff();
      setShowScheduleModal(false);
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast.error(`Failed to update schedule: ${error.message}`);
    }
  };

  const handlePayRateEdit = (assignmentId: string, currentRate: number) => {
    setEditingPayRate(assignmentId);
    setTempPayRate(currentRate?.toString() || '12.00');
  };

  const handlePayRateUpdate = async (assignmentId: string) => {
    try {
      const payRate = parseFloat(tempPayRate);
      if (isNaN(payRate) || payRate < 0) {
        toast.error('Please enter a valid pay rate');
        return;
      }

      // First, check if pay_rate column exists by trying to update it
      const { error } = await supabase
        .from('branch_staff_assignments')
        .update({ pay_rate: payRate })
        .eq('id', assignmentId);

      if (error) {
        // If column doesn't exist, show a helpful message
        if (error.message?.includes('column "pay_rate" of relation "branch_staff_assignments" does not exist')) {
          toast.error('Pay rate feature requires database update. Please contact administrator to add pay_rate column.');
          console.log('Run this SQL in Supabase: ALTER TABLE branch_staff_assignments ADD COLUMN pay_rate DECIMAL(10, 2) DEFAULT 12.00;');
        } else {
          console.error('Database error:', error);
          toast.error(`Failed to update pay rate: ${error.message}`);
        }
        return;
      }

      toast.success('Pay rate updated successfully');
      setEditingPayRate(null);
      setTempPayRate('');
      loadAssignedStaff();
      onStaffChanged?.();
    } catch (error) {
      console.error('Error updating pay rate:', error);
      toast.error('Failed to update pay rate');
    }
  };

  const handlePayRateCancel = () => {
    setEditingPayRate(null);
    setTempPayRate('');
  };

  const renderScheduleSummary = (workSchedule: any) => {
    if (!workSchedule) {
      return (
        <span className="text-sm text-gray-500 italic">No schedule set</span>
      );
    }
    
    // Get current day
    const currentDay = new Date().toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
    const todaySchedule = workSchedule[currentDay];
    
    // Count work days
    const workDays = Object.keys(workSchedule).filter(day => workSchedule[day]?.workDay).length;
    
    if (!todaySchedule?.workDay) {
      return (
        <div className="text-sm">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
              Today ({currentDay})
            </span>
            <span className="text-gray-500">Day Off</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {workDays} work days per week
          </div>
        </div>
      );
    }

    return (
      <div className="text-sm">
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 capitalize">
            Today ({currentDay})
          </span>
          <span className="font-medium text-gray-900">
            {todaySchedule.start} - {todaySchedule.end}
          </span>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {workDays} work days per week
        </div>
      </div>
    );
  };

  const getUserInitials = (user: User) => {
    return `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}`.toUpperCase();
  };

  const getUserRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'administrator': return 'bg-purple-100 text-purple-800';
      case 'manager': return 'bg-orange-100 text-orange-800';
      case 'pharmacist': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Manage Staff</h3>
              <p className="text-sm text-gray-500 mt-1">
                Assign staff members and manage their schedules
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Add Staff Button */}
          <div className="mb-6">
            <button
              onClick={handleAddStaffClick}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Staff Member
            </button>
          </div>

          {/* Assigned Staff List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900">
                Assigned Staff ({assignedStaff.length})
              </h4>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading staff...</span>
              </div>
            ) : assignedStaff.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No staff assigned</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by adding your first staff member.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {assignedStaff.map((assignment) => (
                  <div key={assignment.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        {/* Avatar */}
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        
                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <h5 className="text-lg font-semibold text-gray-900 truncate">
                              {assignment.user.first_name} {assignment.user.last_name}
                            </h5>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUserRoleColor(assignment.user.role)}`}>
                              {assignment.user.role}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-1">{assignment.user.email}</p>
                          <p className="text-sm text-gray-500 mb-3">
                            Position: {assignment.position || 'Staff'} • 
                            Assigned: {new Date(assignment.assignment_date).toLocaleDateString()}
                          </p>
                          
                          {/* Pay Rate Display */}
                          <div className="bg-green-50 rounded-lg p-3 mb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h6 className="text-sm font-medium text-gray-700">Hourly Rate</h6>
                              </div>
                              {editingPayRate === assignment.id ? (
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-medium text-gray-700">£</span>
                                  <input
                                    type="number"
                                    value={tempPayRate}
                                    onChange={(e) => setTempPayRate(e.target.value)}
                                    step="0.01"
                                    min="0"
                                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                  />
                                  <span className="text-sm text-gray-500">/hr</span>
                                  <button
                                    onClick={() => handlePayRateUpdate(assignment.id)}
                                    className="text-green-600 hover:text-green-800 text-xs font-medium"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handlePayRateCancel}
                                    className="text-gray-400 hover:text-gray-600 text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold text-green-700">
                                    £{(assignment.pay_rate || 12.00).toFixed(2)}/hr
                                  </span>
                                  <button
                                    onClick={() => handlePayRateEdit(assignment.id, assignment.pay_rate || 12.00)}
                                    className="text-xs text-green-600 hover:text-green-800 font-medium"
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Schedule Display */}
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h6 className="text-sm font-medium text-gray-700">Current Schedule</h6>
                              <button
                                onClick={() => handleSetSchedule(assignment.id, assignment.user_id)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Edit Schedule
                              </button>
                            </div>
                            {renderScheduleSummary(assignment.work_schedule)}
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-col space-y-2 ml-4">
                        <button
                          onClick={() => handleSetSchedule(assignment.id, assignment.user_id)}
                          className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                        >
                          Set Schedule
                        </button>
                        <button
                          onClick={() => handleRemoveStaff(assignment.id)}
                          className="px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Staff Modal */}
          {showAddStaff && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl w-96 max-h-[80vh] overflow-y-auto">
                <h4 className="text-lg font-semibold mb-4">Add New Staff Member</h4>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {availableUsers.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No available users to assign</p>
                  ) : (
                    availableUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-medium text-xs">
                            {getUserInitials(user)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.first_name} {user.last_name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAssignStaff(user.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Assign
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowAddStaff(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Schedule Modal */}
          {showScheduleModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl w-[600px] max-h-[80vh] overflow-y-auto">
                <h4 className="text-lg font-semibold mb-4">Set Work Schedule</h4>
                <div className="space-y-4">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-4 mb-3">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={`workday-${day}`}
                            checked={schedule[day]?.workDay || false}
                            onChange={(e) => setSchedule(prev => ({
                              ...prev,
                              [day]: { 
                                ...prev[day], 
                                workDay: e.target.checked,
                                start: prev[day]?.start || '09:00',
                                end: prev[day]?.end || '17:00'
                              }
                            }))}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={`workday-${day}`} className="w-24 capitalize font-medium text-gray-700 cursor-pointer">
                            {day}
                          </label>
                        </div>
                        
                        {schedule[day]?.workDay ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Work Day
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Day Off
                          </span>
                        )}
                      </div>
                      
                      {schedule[day]?.workDay && (
                        <div className="flex items-center space-x-4 ml-7">
                          <input
                            type="time"
                            value={schedule[day]?.start || '09:00'}
                            onChange={(e) => setSchedule(prev => ({
                              ...prev,
                              [day]: { ...prev[day], start: e.target.value }
                            }))}
                            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <span className="text-gray-500 font-medium">to</span>
                          <input
                            type="time"
                            value={schedule[day]?.end || '17:00'}
                            onChange={(e) => setSchedule(prev => ({
                              ...prev,
                              [day]: { ...prev[day], end: e.target.value }
                            }))}
                            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowScheduleModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSchedule}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save Schedule
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 