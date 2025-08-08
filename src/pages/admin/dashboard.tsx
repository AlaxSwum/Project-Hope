import { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { authService, userService, UserData } from '../../lib/supabase-secure';
import { checklistService, timeTrackingService } from '../../lib/supabase-secure';
import { branchService } from '../../lib/branch-service';
import { passwordManagerService, PasswordFolder, PasswordEntry } from '../../lib/password-manager-service';
import BranchLocationPicker from '../../components/BranchLocationPicker';
import BranchCard from '../../components/BranchCard';
import BranchTimeManagement from '../../components/BranchTimeManagement';
import AssignStaffModal from '../../components/AssignStaffModal';
import HolidayManagement from '../../components/HolidayManagement';
import { PasswordFolderModal } from '../../components/PasswordFolderModal';
import { EnhancedPasswordEntryModal } from '../../components/EnhancedPasswordEntryModal';
import { PasswordDetailsModal } from '../../components/PasswordDetailsModal';
import { PasswordShareModal } from '../../components/PasswordShareModal';
import { toast } from 'react-toastify';

// Helper function to format hours and minutes
const formatHoursMinutes = (totalHours: number): string => {
  if (totalHours === 0) return '0h';
  
  const hours = Math.floor(totalHours);
  const remainingMinutes = (totalHours - hours) * 60;
  const minutes = Math.floor(remainingMinutes);
  const seconds = Math.round((remainingMinutes - minutes) * 60);
  
  // For very small durations, show seconds too
  if (hours === 0 && minutes === 0 && seconds > 0) {
    return `${seconds}s`;
  }
  
  if (hours === 0 && minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  
  if (minutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${minutes}m`;
};

const AdminDashboard: NextPage = () => {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Initialize activeSection from localStorage to persist across refreshes
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('adminActiveSection') || 'users';
    }
    return 'users';
  });

  // Save activeSection to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('adminActiveSection', activeSection);
    }
  }, [activeSection]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showEditUser, setShowEditUser] = useState(false);

  // Checklist state
  const [folders, setFolders] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showCreateChecklist, setShowCreateChecklist] = useState(false);
  const [showManageItems, setShowManageItems] = useState(false);

  // Branch management state
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [showEditBranch, setShowEditBranch] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [showAssignStaff, setShowAssignStaff] = useState(false);
  const [branchStaff, setBranchStaff] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [showBranchDetails, setShowBranchDetails] = useState(false);
  const [selectedBranchForDetails, setSelectedBranchForDetails] = useState<any>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [selectedBranchForMonitoring, setSelectedBranchForMonitoring] = useState<any>(null);
  const [branchStaffProgress, setBranchStaffProgress] = useState<any[]>([]);
  
  // Time management state
  const [showTimeManagement, setShowTimeManagement] = useState(false);
  const [selectedBranchForTime, setSelectedBranchForTime] = useState<any>(null);
  const [branchStaffCounts, setBranchStaffCounts] = useState<{[key: string]: { active: number; onBreak: number; total: number }}>({});
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Edit states
  const [editingFolder, setEditingFolder] = useState<any>(null);
  const [showEditFolder, setShowEditFolder] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<any>(null);
  const [showEditChecklist, setShowEditChecklist] = useState(false);
  
  // Monitoring states
  const [allUsersProgress, setAllUsersProgress] = useState<any[]>([]);
  const [monitoringDate, setMonitoringDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Payslip states
  const [payslipData, setPayslipData] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showEmployeeDetails, setShowEmployeeDetails] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [loadingPayslips, setLoadingPayslips] = useState(false);

  // Password Manager states
  const [passwordFolders, setPasswordFolders] = useState<PasswordFolder[]>([]);
  const [passwordEntries, setPasswordEntries] = useState<PasswordEntry[]>([]);
  const [selectedPasswordFolder, setSelectedPasswordFolder] = useState<PasswordFolder | null>(null);
  const [selectedPasswordEntry, setSelectedPasswordEntry] = useState<PasswordEntry | null>(null);
  const [showCreatePasswordFolder, setShowCreatePasswordFolder] = useState(false);
  const [showCreatePasswordEntry, setShowCreatePasswordEntry] = useState(false);
  const [showEditPasswordFolder, setShowEditPasswordFolder] = useState(false);
  const [showEditPasswordEntry, setShowEditPasswordEntry] = useState(false);
  const [showPasswordDetails, setShowPasswordDetails] = useState(false);
  const [showSharePassword, setShowSharePassword] = useState(false);
  const [editingPasswordFolder, setEditingPasswordFolder] = useState<PasswordFolder | null>(null);
  const [editingPasswordEntry, setEditingPasswordEntry] = useState<PasswordEntry | null>(null);
  const [loadingPasswords, setLoadingPasswords] = useState(false);

  useEffect(() => {
    checkAuth();
    loadUsers();
    if (activeSection === 'checklists') {
      loadFolders();
    }
    if (activeSection === 'branches') {
      loadBranches();
      branches.forEach(branch => loadBranchStaffCounts(branch.id));
    }
    if (activeSection === 'monitoring') {
      // Ensure both progress data and branch list are loaded for monitoring screen
      loadAllUsersProgress();
      loadBranches();
    }
    if (activeSection === 'payslips') {
      loadPayslipData();
    }
    if (activeSection === 'passwords') {
      loadPasswordFolders();
    }
  }, [activeSection, monitoringDate, currentMonth]);

  const checkAuth = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const isAdmin = await authService.isAdmin();
      if (!isAdmin) {
        router.push('/dashboard'); // Redirect non-admins
        return;
      }

      setCurrentUser(user);
      
      // Try to get the user profile from database
      try {
        const userWithProfile = await authService.getCurrentUserWithProfile();
        setUserProfile(userWithProfile?.profile);
      } catch (error) {
        console.log('Profile data not available yet:', error);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/login');
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await userService.getAllUsers();
      if (error) {
        console.error('Failed to load users:', error);
      } else {
        setUsers(data || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Checklist functions
  const loadFolders = async (branchId?: string) => {
    try {
      const { data, error } = await checklistService.getFolders(branchId);
      if (error) {
        console.error('Failed to load folders:', error);
        // Show user-friendly message
        if (error.message?.includes('database setup')) {
          alert('Database not set up. Please follow the setup instructions in setup-database.md');
        }
      } else {
        setFolders(data || []);
      }
    } catch (error) {
      console.error('Error loading folders:', error);
      alert('Unable to connect to database. Please check your environment variables.');
    }
  };

  const loadChecklists = async (folderId?: string) => {
    try {
      const { data, error } = await checklistService.getChecklists(folderId);
      if (error) {
        console.error('Failed to load checklists:', error);
      } else {
        setChecklists(data || []);
      }
    } catch (error) {
      console.error('Error loading checklists:', error);
    }
  };

  const loadChecklistItems = async (checklistId: string) => {
    try {
      const { data, error } = await checklistService.getChecklistItems(checklistId);
      if (error) {
        console.error('Failed to load checklist items:', error);
      } else {
        setChecklistItems(data || []);
      }
    } catch (error) {
      console.error('Error loading checklist items:', error);
    }
  };

  const handleFolderSelect = (folder: any) => {
    setSelectedFolder(folder);
    setSelectedChecklist(null);
    setChecklistItems([]);
    loadChecklists(folder.id);
  };

  const handleChecklistSelect = (checklist: any) => {
    setSelectedChecklist(checklist);
    loadChecklistItems(checklist.id);
  };

  const handleSignOut = async () => {
    await authService.signOut();
    router.push('/login');
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await userService.deleteUser(userId);
      if (error) {
        const errorMessage = error?.message || error || 'Unknown error occurred';
        alert('Error deleting user: ' + errorMessage);
      } else {
        alert('User deleted successfully');
        loadUsers(); // Refresh the list
      }
    } catch (error: any) {
      const errorMessage = error?.message || error || 'Unknown error occurred';
      alert('Error deleting user: ' + errorMessage);
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setShowEditUser(true);
  };

  const handleUpdateUser = async (updatedUserData: any) => {
    try {
      // For now, we'll just close the modal and refresh
      // In a real implementation, you'd call an update API
      setShowEditUser(false);
      setEditingUser(null);
      loadUsers(); // Refresh the list
      alert('User updated successfully');
    } catch (error) {
      alert('Error updating user');
    }
  };

  // Folder and checklist management functions
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`Are you sure you want to delete the folder "${folderName}"? This will also delete all checklists inside it.`)) {
      return;
    }

    try {
      const { error } = await checklistService.deleteFolder(folderId);
      if (error) {
        alert('Error deleting folder: ' + error.message);
      } else {
        alert('Folder deleted successfully');
        loadFolders(); // Refresh the list
        // Clear selection if deleted folder was selected
        if (selectedFolder?.id === folderId) {
          setSelectedFolder(null);
          setChecklists([]);
        }
      }
    } catch (error) {
      alert('Error deleting folder');
    }
  };

  const handleDeleteChecklist = async (checklistId: string, checklistName: string) => {
    if (!confirm(`Are you sure you want to delete the checklist "${checklistName}"?`)) {
      return;
    }

    try {
      const { error } = await checklistService.deleteChecklist(checklistId);
      if (error) {
        alert('Error deleting checklist: ' + error.message);
      } else {
        alert('Checklist deleted successfully');
        if (selectedFolder) {
          loadChecklists(selectedFolder.id); // Refresh the list
        }
        // Clear selection if deleted checklist was selected
        if (selectedChecklist?.id === checklistId) {
          setSelectedChecklist(null);
          setChecklistItems([]);
        }
      }
    } catch (error) {
      alert('Error deleting checklist');
    }
  };

  // Branch management functions
  const loadBranches = async () => {
    try {
      const { data, error } = await branchService.getAllBranches();
      if (error) {
        console.error('Failed to load branches:', error);
      } else {
        setBranches(data || []);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const loadBranchStaff = async (branchId: string) => {
    setLoadingStaff(true);
    try {
      const { data, error } = await branchService.getBranchStaff(branchId);
      if (error) {
        console.error('Error loading branch staff:', error);
        setBranchStaff([]);
      } else {
        setBranchStaff(data || []);
      }
    } catch (error) {
      console.error('Error loading branch staff:', error);
      setBranchStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  };

  const loadBranchStaffCounts = async (branchId: string) => {
    try {
      const { data: activeStaff } = await timeTrackingService.getActiveStaff(branchId);
      const { data: staffOnBreak } = await timeTrackingService.getStaffOnBreak(branchId);
      const { data: branchStaff } = await branchService.getBranchStaff(branchId);
      
      setBranchStaffCounts(prev => ({
        ...prev,
        [branchId]: {
          active: activeStaff?.length || 0,
          onBreak: staffOnBreak?.length || 0,
          total: branchStaff?.length || 0
        }
      }));
    } catch (error) {
      console.error('Error loading branch staff counts:', error);
    }
  };

  const handleBranchSelect = (branch: any) => {
    setSelectedBranch(branch);
    // Load branch-specific data
    loadFolders(branch.id);
    loadBranchStaff(branch.id);
  };

  const handleBranchCardClick = async (branch: any) => {
    setSelectedBranchForDetails(branch);
    setShowBranchDetails(true);
    // Load staff for this branch
    await loadBranchStaff(branch.id);
  };

  const toggleFolderExpansion = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const toggleBranchExpansion = (branchId: string) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(branchId)) {
      newExpanded.delete(branchId);
    } else {
      newExpanded.add(branchId);
    }
    setExpandedBranches(newExpanded);
  };

  const handleBranchMonitoringSelect = async (branch: any) => {
    setSelectedBranchForMonitoring(branch);
    // Use branch_id from enriched progress data
    const branchProgress = allUsersProgress.filter(progress => progress.branch_id === branch.id);
    setBranchStaffProgress(branchProgress);
  };

  const handleBackToBranchList = () => {
    setSelectedBranchForMonitoring(null);
    setBranchStaffProgress([]);
  };

  const handleCreateBranch = async (branchData: any) => {
    try {
      const { error } = await branchService.createBranch(branchData);
      if (error) {
        alert('Error creating branch: ' + error.message);
      } else {
        alert('Branch created successfully');
        loadBranches();
        setShowCreateBranch(false);
      }
    } catch (error) {
      alert('Error creating branch');
    }
  };

  const handleEditBranch = (branch: any) => {
    setEditingBranch(branch);
    setShowEditBranch(true);
  };

  const handleDeleteBranch = async (branchId: string, branchName: string) => {
    if (!confirm(`Are you sure you want to delete "${branchName}"? This will remove all associated data.`)) {
      return;
    }

    try {
      const { error } = await branchService.deleteBranch(branchId);
      if (error) {
        alert('Error deleting branch: ' + error.message);
      } else {
        alert('Branch deleted successfully');
        loadBranches();
        if (selectedBranch?.id === branchId) {
          setSelectedBranch(null);
        }
      }
    } catch (error) {
      alert('Error deleting branch');
    }
  };

  // Monitoring functions
  const loadAllUsersProgress = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await checklistService.getAllUsersProgress(monitoringDate);
      if (error) {
        console.error('Failed to load users progress:', error);
        alert('Failed to load progress data. Please check the console for details.');
      } else {
        console.log('Loaded progress data:', data); // Debug log
        setAllUsersProgress(data || []);
      }
    } catch (error) {
      console.error('Error loading users progress:', error);
      alert('Error loading progress data. Please check the console for details.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Payslip functions
  const loadPayslipData = async () => {
    setLoadingPayslips(true);
    try {
      // Get the first and last day of the selected month
      const startDate = `${currentMonth}-01`;
      const endDate = new Date(new Date(currentMonth).getFullYear(), new Date(currentMonth).getMonth() + 1, 0).toISOString().slice(0, 10);
      
      // Get all branches and users with their time entries for the month
      const { data: branches, error: branchError } = await branchService.getAllBranches();
      if (branchError) {
        console.error('Failed to load branches:', branchError);
        return;
      }

      const payslipPromises = branches.map(async (branch: any) => {
        const { data: branchStaff, error: staffError } = await branchService.getBranchStaff(branch.id);
        if (staffError) {
          console.error(`Failed to load staff for branch ${branch.name}:`, staffError);
          return { branch, employees: [] };
        }

        const employeePromises = branchStaff.map(async (staff: any) => {
          // Get time entries with break data
          const { data: timeEntries, error: timeError } = await timeTrackingService.getTimeEntriesWithBreaks(staff.user_id, startDate, endDate);
          
          // Get employee schedule for comparison
          const { data: scheduleData, error: scheduleError } = await timeTrackingService.getEmployeeScheduleForPayroll(staff.user_id, startDate, endDate);
          
          if (timeError) {
            console.error(`Failed to load time entries for user ${staff.user_id}:`, timeError);
            return { 
              ...staff, 
              first_name: staff.user?.first_name || 'Unknown',
              last_name: staff.user?.last_name || 'User',
              email: staff.user?.email || '',
              role: staff.user?.role || 'staff',
              timeEntries: [], 
              totalHours: 0, 
              totalPay: 0,
              totalScheduledHours: 0,
              totalActualHours: 0,
              totalBreakHours: 0,
              overtimeHours: 0
            };
          }

          const staffPayRate = staff.pay_rate || 12.00;
          let totalActualHours = 0;
          let totalBreakHours = 0;
          let totalScheduledHours = scheduleData?.totalScheduledHours || 0;

          // Group entries by date and combine same-day entries
          const entriesByDate = (timeEntries || []).reduce((acc: any, entry: any) => {
            const clockIn = entry.clock_in_time ? new Date(entry.clock_in_time) : null;
            const entryDate = clockIn ? clockIn.toISOString().split('T')[0] : '';
            
            if (!acc[entryDate]) {
              acc[entryDate] = [];
            }
            acc[entryDate].push(entry);
            return acc;
          }, {});

          // Process combined daily entries
          const processedEntries = Object.entries(entriesByDate).map(([date, dayEntries]: [string, any]) => {
            const sortedEntries = dayEntries.sort((a: any, b: any) => 
              new Date(a.clock_in_time).getTime() - new Date(b.clock_in_time).getTime()
            );

            // Get first clock in and last clock out of the day
            const firstEntry = sortedEntries[0];
            const lastEntry = sortedEntries[sortedEntries.length - 1];
            
            const clockIn = firstEntry.clock_in_time ? new Date(firstEntry.clock_in_time) : null;
            const clockOut = lastEntry.clock_out_time ? new Date(lastEntry.clock_out_time) : null;

            // Combine all breaks from the day
            const allBreaks = sortedEntries.flatMap((entry: any) => entry.breaks || []);
            const totalBreakMinutes = allBreaks.reduce((total: number, breakEntry: any) => {
              if (breakEntry.clock_in_time && breakEntry.clock_out_time) {
                const breakStart = new Date(breakEntry.clock_in_time);
                const breakEnd = new Date(breakEntry.clock_out_time);
                const breakDuration = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
                return total + breakDuration;
              }
              return total;
            }, 0);

            // Find scheduled hours for this day
            const daySchedule = scheduleData?.dailySchedule?.find((ds: any) => ds.date === date);
            const scheduledHoursForDay = daySchedule?.scheduledHours || 0;

            // Calculate actual worked hours ONLY within scheduled time slots
            let actualHours = 0;
            let payableHours = 0;

            if (clockIn && clockOut && daySchedule) {
              // Parse scheduled start and end times
              const [schedStartHour, schedStartMin] = daySchedule.startTime.split(':').map(Number);
              const [schedEndHour, schedEndMin] = daySchedule.endTime.split(':').map(Number);
              
              // Create scheduled time boundaries for this date
              const scheduleStart = new Date(clockIn);
              scheduleStart.setHours(schedStartHour, schedStartMin, 0, 0);
              
              const scheduleEnd = new Date(clockIn);
              scheduleEnd.setHours(schedEndHour, schedEndMin, 0, 0);

              // Get actual work period (bounded by schedule)
              const workStart = new Date(Math.max(clockIn.getTime(), scheduleStart.getTime()));
              const workEnd = new Date(Math.min(clockOut.getTime(), scheduleEnd.getTime()));

              if (workEnd > workStart) {
                // Calculate hours worked within schedule
                const totalMinutes = (workEnd.getTime() - workStart.getTime()) / (1000 * 60);
                const workMinutes = totalMinutes - totalBreakMinutes;
                actualHours = Math.max(0, workMinutes / 60);
                
                // Payable hours are the actual hours within schedule, capped at scheduled hours
                payableHours = Math.min(actualHours, scheduledHoursForDay);
              }
            } else if (clockIn && clockOut && !daySchedule) {
              // If no schedule exists, calculate normally (fallback)
              const totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
              const workMinutes = totalMinutes - totalBreakMinutes;
              actualHours = Math.max(0, workMinutes / 60);
              payableHours = actualHours;
            }

            const displayHours = payableHours;

            totalActualHours += actualHours;
            totalBreakHours += totalBreakMinutes / 60;

            return {
              id: `combined-${date}`,
              clock_in_time: firstEntry.clock_in_time,
              clock_out_time: lastEntry.clock_out_time,
              breaks: allBreaks,
              totalBreakMinutes: Math.round(totalBreakMinutes),
              totalBreakHours: Math.round((totalBreakMinutes / 60) * 100) / 100,
              actualHours: Math.round(actualHours * 100) / 100, // Hours worked within schedule
              displayHours: Math.round(displayHours * 100) / 100, // Payable hours (within schedule)
              payableHours: Math.round(payableHours * 100) / 100, // Same as displayHours
              scheduledHoursForDay: Math.round(scheduledHoursForDay * 100) / 100,
              daySchedule: daySchedule,
              holidayInfo: firstEntry.holidayInfo, // Use first entry's holiday info
              autoClockOut: lastEntry.autoClockOut,
              date: date,
              combinedEntries: sortedEntries.length,
              withinSchedule: !!daySchedule // Flag to indicate if schedule was applied
            };
          });

          // Calculate total payable hours from all processed entries (already schedule-bounded)
          const totalPayableHours = processedEntries.reduce((sum, entry) => sum + (entry.payableHours || 0), 0);
          const totalPay = totalPayableHours * staffPayRate;
          
          // Keep track of actual overtime for informational purposes only
          // Only calculate overtime if there's a schedule set
          const overtimeHours = totalScheduledHours > 0 ? Math.max(0, totalActualHours - totalScheduledHours) : 0;

          return {
            ...staff,
            first_name: staff.user?.first_name || 'Unknown',
            last_name: staff.user?.last_name || 'User',
            email: staff.user?.email || '',
            role: staff.user?.role || 'staff',
            position: staff.position || staff.user?.position || 'Staff',
            timeEntries: processedEntries,
            totalHours: Math.round(totalPayableHours * 100) / 100, // Show payable hours in summary
            totalScheduledHours: Math.round(totalScheduledHours * 100) / 100,
            totalActualHours: Math.round(totalActualHours * 100) / 100,
            totalBreakHours: Math.round(totalBreakHours * 100) / 100,
            overtimeHours: Math.round(overtimeHours * 100) / 100,
            payableHours: Math.round(totalPayableHours * 100) / 100,
            totalPay: Math.round(totalPay * 100) / 100,
            scheduleData: scheduleData
          };
        });

        const employees = await Promise.all(employeePromises);
        return { branch, employees };
      });

      const result = await Promise.all(payslipPromises);
      setPayslipData(result);
    } catch (error) {
      console.error('Error loading payslip data:', error);
    } finally {
      setLoadingPayslips(false);
    }
  };

  // Password Manager functions
  const loadPasswordFolders = async () => {
    setLoadingPasswords(true);
    try {
      const { data, error } = await passwordManagerService.getFolders();
      if (error) {
        console.error('Failed to load password folders:', error);
        toast.error('Failed to load password folders');
      } else {
        setPasswordFolders(data || []);
      }
    } catch (error) {
      console.error('Error loading password folders:', error);
      toast.error('Error loading password folders');
    } finally {
      setLoadingPasswords(false);
    }
  };

  const loadPasswordEntries = async (folderId?: string) => {
    try {
      const { data, error } = await passwordManagerService.getPasswordEntries(folderId);
      if (error) {
        console.error('Failed to load password entries:', error);
        toast.error('Failed to load password entries');
      } else {
        setPasswordEntries(data || []);
      }
    } catch (error) {
      console.error('Error loading password entries:', error);
      toast.error('Error loading password entries');
    }
  };

  const handlePasswordFolderSelect = (folder: PasswordFolder) => {
    setSelectedPasswordFolder(folder);
    setSelectedPasswordEntry(null);
    loadPasswordEntries(folder.id);
  };

  const handlePasswordEntrySelect = async (entry: PasswordEntry) => {
    // Load the full entry with enhanced fields
    const { data: fullEntry, error } = await passwordManagerService.getPasswordEntryWithEnhancedFields(entry.id);
    if (error) {
      toast.error('Error loading password details: ' + error.message);
      return;
    }
    setSelectedPasswordEntry(fullEntry);
    setShowPasswordDetails(true);
  };

  const handleCreatePasswordFolder = async (folderData: Omit<PasswordFolder, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    try {
      const { error } = await passwordManagerService.createFolder(folderData);
      if (error) {
        toast.error('Error creating password folder: ' + error.message);
      } else {
        toast.success('Password folder created successfully');
        loadPasswordFolders();
        setShowCreatePasswordFolder(false);
      }
    } catch (error) {
      toast.error('Error creating password folder');
    }
  };

  const handleCreatePasswordEntry = async (entryData: Omit<PasswordEntry, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    try {
      const { error } = await passwordManagerService.createPasswordEntry(entryData);
      if (error) {
        toast.error('Error creating password entry: ' + error.message);
      } else {
        toast.success('Password entry created successfully');
        if (selectedPasswordFolder) {
          loadPasswordEntries(selectedPasswordFolder.id);
        }
        setShowCreatePasswordEntry(false);
      }
    } catch (error) {
      toast.error('Error creating password entry');
    }
  };

  const handleEditPasswordFolder = (folder: PasswordFolder) => {
    setEditingPasswordFolder(folder);
    setShowEditPasswordFolder(true);
  };

  const handleEditPasswordEntry = async (entry: PasswordEntry) => {
    try {
      // Fetch the full entry with enhanced fields
      const { data: fullEntry, error } = await passwordManagerService.getPasswordEntryWithEnhancedFields(entry.id);
      if (error) {
        console.error('Failed to load full password entry:', error);
        toast.error('Failed to load password entry details');
        return;
      }
      setEditingPasswordEntry(fullEntry);
      setShowEditPasswordEntry(true);
    } catch (error) {
      console.error('Error loading password entry:', error);
      toast.error('Error loading password entry');
    }
  };

  const handleUpdatePasswordFolder = async (id: string, updates: Partial<PasswordFolder>) => {
    try {
      const { error } = await passwordManagerService.updateFolder(id, updates);
      if (error) {
        toast.error('Error updating password folder: ' + error.message);
      } else {
        toast.success('Password folder updated successfully');
        loadPasswordFolders();
        setShowEditPasswordFolder(false);
        setEditingPasswordFolder(null);
      }
    } catch (error) {
      toast.error('Error updating password folder');
    }
  };

  const handleUpdatePasswordEntry = async (id: string, updates: Partial<PasswordEntry>) => {
    try {
      const { error } = await passwordManagerService.updatePasswordEntry(id, updates);
      if (error) {
        toast.error('Error updating password entry: ' + error.message);
      } else {
        toast.success('Password entry updated successfully');
        if (selectedPasswordFolder) {
          loadPasswordEntries(selectedPasswordFolder.id);
        }
        setShowEditPasswordEntry(false);
        setEditingPasswordEntry(null);
      }
    } catch (error) {
      toast.error('Error updating password entry');
    }
  };

  const handleDeletePasswordFolder = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the folder "${name}"? This will also delete all passwords inside it.`)) {
      return;
    }

    try {
      const { error } = await passwordManagerService.deleteFolder(id);
      if (error) {
        toast.error('Error deleting password folder: ' + error.message);
      } else {
        toast.success('Password folder deleted successfully');
        loadPasswordFolders();
        if (selectedPasswordFolder?.id === id) {
          setSelectedPasswordFolder(null);
          setPasswordEntries([]);
        }
      }
    } catch (error) {
      toast.error('Error deleting password folder');
    }
  };

  const handleDeletePasswordEntry = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the password entry "${name}"?`)) {
      return;
    }

    try {
      const { error } = await passwordManagerService.deletePasswordEntry(id);
      if (error) {
        toast.error('Error deleting password entry: ' + error.message);
      } else {
        toast.success('Password entry deleted successfully');
        if (selectedPasswordFolder) {
          loadPasswordEntries(selectedPasswordFolder.id);
        }
        if (selectedPasswordEntry?.id === id) {
          setSelectedPasswordEntry(null);
          setShowPasswordDetails(false);
        }
      }
    } catch (error) {
      toast.error('Error deleting password entry');
    }
  };

  const handleSharePassword = async (entryId: string, permissions: any[]) => {
    try {
      const { error } = await passwordManagerService.sharePassword(entryId, permissions);
      if (error) {
        toast.error('Error sharing password: ' + error.message);
      } else {
        toast.success('Password sharing updated successfully');
        if (selectedPasswordFolder) {
          loadPasswordEntries(selectedPasswordFolder.id);
        }
        setShowSharePassword(false);
        setSelectedPasswordEntry(null);
      }
    } catch (error) {
      toast.error('Error sharing password');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading management dashboard...</p>
        </div>
      </div>
    );
  }

  // Get user data from multiple sources
  const userRole = userProfile?.role || currentUser?.user_metadata?.role || 'administrator';
  const firstName = userProfile?.first_name || currentUser?.user_metadata?.first_name || 'User';
  const lastName = userProfile?.last_name || currentUser?.user_metadata?.last_name || '';
  const fullName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : currentUser?.user_metadata?.full_name || `${firstName} ${lastName}`;
  const position = userProfile?.position || currentUser?.user_metadata?.position || '';

  const navigation = [
    { 
      name: 'Users', 
      id: 'users', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ), 
      current: activeSection === 'users' 
    },
    { 
      name: 'Checklists', 
      id: 'checklists', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ), 
      current: activeSection === 'checklists' 
    },
    { 
      name: 'Branches', 
      id: 'branches', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ), 
      current: activeSection === 'branches' 
    },
    
    { 
      name: 'SOP Management', 
      id: 'sop', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ), 
      current: activeSection === 'sop' 
    },
    { 
      name: 'Monitoring', 
      id: 'monitoring', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ), 
      current: activeSection === 'monitoring' 
    },
              {
            name: 'Payslips',
            id: 'payslips',
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            current: activeSection === 'payslips'
          },
          {
            name: 'Holidays',
            id: 'holidays',
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V3m6 4V3m-6 0h6m-6 0L9 21l3-3 3 3-3-9z" />
              </svg>
            ),
            current: activeSection === 'holidays'
          },
          {
            name: 'Password Manager',
            id: 'passwords',
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            ),
            current: activeSection === 'passwords'
          },
    { 
      name: 'Overview', 
      id: 'overview', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      ), 
      current: activeSection === 'overview' 
    },
    { 
      name: 'System Settings', 
      id: 'settings', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ), 
      current: activeSection === 'settings' 
    },
  ];

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const handleLocationSave = async (branchId: string) => {
    try {
      // The BranchLocationPicker component handles the actual save
      // We just need to reload data and close the modal
      await loadBranches();
      setShowLocationPicker(false);
      setSelectedBranch(null);
      toast.success('Branch location updated successfully');
    } catch (error) {
      console.error('Error updating branch location:', error);
      toast.error('Failed to update branch location');
    }
  };

  return (
    <>
      <Head>
        <title>Management Dashboard - Hope Pharmacy IMS</title>
      </Head>

      <div className="min-h-screen bg-gray-50 flex">
        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)}></div>
            <div className="fixed top-0 left-0 w-64 h-full bg-white shadow-lg z-50">
              <div className="flex flex-col h-full">
                {/* Mobile Logo and Close Button */}
                <div className="flex items-center justify-between px-6 py-6 border-b border-gray-100">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-lg">H</span>
                    </div>
                    <div className="ml-3">
                      <h1 className="text-lg font-bold text-gray-900">Management Panel</h1>
                      <p className="text-xs text-gray-500">Hope Pharmacy IMS</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Mobile User Info */}
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {userProfile?.first_name?.charAt(0) || 'A'}{userProfile?.last_name?.charAt(0) || 'D'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Administrator'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">Administrator • Management Panel</p>
                    </div>
                  </div>
                </div>

                {/* Mobile Navigation */}
                <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
                  {[
                    { id: 'users', name: 'User Management', icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-2.239" />
                      </svg>
                    )},
                    { id: 'checklists', name: 'Checklist Management', icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    )},
                    { id: 'branches', name: 'Branch Management', icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    )},
                    { id: 'payslips', name: 'Payroll Management', icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )},
                    { id: 'holidays', name: 'Holiday Management', icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveSection(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`${
                        activeSection === item.id
                          ? 'bg-purple-50 border-purple-300 text-purple-700'
                          : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } group flex items-center px-3 py-2 text-sm font-medium border-l-4 rounded-r-lg transition-all duration-200 w-full`}
                    >
                      <span className={`${activeSection === item.id ? 'text-purple-500' : 'text-gray-400 group-hover:text-gray-500'} mr-3`}>
                        {item.icon}
                      </span>
                      <span className="flex-1 text-left">{item.name}</span>
                    </button>
                  ))}
                </nav>

                {/* Mobile Sign Out */}
                <div className="px-6 py-4 border-t border-gray-100">
                  <a
                    href="/dashboard"
                    className="group flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 w-full mb-2"
                  >
                    <svg className="text-gray-400 group-hover:text-blue-500 mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6a2 2 0 01-2 2H10a2 2 0 01-2-2V5z" />
                    </svg>
                    User Dashboard
                  </a>
                  <button
                    onClick={handleSignOut}
                    className="group flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 w-full"
                  >
                    <svg className="text-gray-400 group-hover:text-red-500 mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Sidebar */}
        <div className="hidden md:flex md:w-64 md:flex-col">
          <div className="flex flex-col flex-grow bg-white border-r border-gray-200 shadow-sm">
            {/* Logo and Title */}
            <div className="flex items-center flex-shrink-0 px-6 py-6 border-b border-gray-100">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">H</span>
              </div>
              <div className="ml-3">
                <h1 className="text-lg font-bold text-gray-900">Management Panel</h1>
                <p className="text-xs text-gray-500">Hope Pharmacy IMS</p>
              </div>
              </div>
              


            {/* Back to Dashboard Button */}
            <div className="px-6 py-4">
              <button 
                onClick={() => router.push('/dashboard')}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl px-4 py-3 text-sm font-semibold flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </button>
                </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-2 space-y-1">
              {navigation.map((item) => (
                <button
                  key={item.name}
                  onClick={() => setActiveSection(item.id)}
                  className={`${
                    item.current
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border-r-2 border-purple-600 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  } group flex items-center px-3 py-3 text-sm font-medium w-full text-left transition-all duration-200 rounded-l-xl`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.name}
                </button>
              ))}
            </nav>

            {/* Bottom User Actions */}
            <div className="flex-shrink-0 p-4 border-t border-gray-100">
                <button
                  onClick={handleSignOut}
                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Header */}
          <div className="md:hidden bg-white shadow-sm border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="ml-3 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">H</span>
                  </div>
                  <h1 className="ml-2 text-lg font-bold text-gray-900">Management Panel</h1>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">
                    {userProfile?.first_name?.charAt(0) || 'A'}{userProfile?.last_name?.charAt(0) || 'D'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Top Header */}
          <header className="hidden md:block bg-white border-b border-gray-200 shadow-sm">
            <div className="px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 capitalize">
                      {activeSection === 'users' ? 'Users' : 
                       activeSection === 'overview' ? 'Overview' : 
                       activeSection === 'branches' ? 'Branch Management' : 
                       activeSection === 'sop' ? 'SOP Management' : 
                       activeSection === 'payslips' ? 'Payslip Management' : 
                       activeSection === 'passwords' ? 'Password Manager' : 
                       activeSection}
                    </h2>
                    <p className="text-sm text-gray-500">{formattedDate}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  {/* Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search users..."
                      className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>

                  {/* Notifications */}
                  <button className="p-2 text-gray-400 hover:text-gray-600 relative rounded-lg hover:bg-gray-50 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 7H3a2 2 0 000 4h18a2 2 0 000-4z" />
                    </svg>
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  </button>

                  {/* User Profile Dropdown */}
                  <div className="flex items-center space-x-3 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">{firstName.charAt(0)}{lastName.charAt(0) || firstName.charAt(1)}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">{firstName}</p>
                      <p className="text-xs text-gray-500">{position || ''}</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto bg-gray-50">
            <div className="px-4 md:px-6 py-4 md:py-8">
              
              {/* Overview Section */}
              {activeSection === 'overview' && (
                <div className="space-y-8">
                  {/* Welcome Section */}
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white relative overflow-hidden">
                    <div className="relative z-10">
                      <h1 className="text-3xl font-bold mb-2">Welcome, {firstName}</h1>
                      <p className="text-purple-100 text-lg">Manage your pharmacy system and users from here</p>
                    </div>
                    <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                      <div className="w-40 h-40 bg-white bg-opacity-10 rounded-full flex items-center justify-center">
                        <svg className="w-20 h-20 text-white opacity-50" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Stats Overview */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">System Overview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="bg-indigo-600 rounded-xl p-6 text-white">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-indigo-200 text-sm font-medium">Total Users</p>
                            <p className="text-3xl font-bold">{users.length}</p>
                          </div>
                          <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                        </div>
                      </div>

                      <div className="bg-green-500 rounded-xl p-6 text-white">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-green-200 text-sm font-medium">Active Staff</p>
                            <p className="text-3xl font-bold">{users.filter(u => u.role !== 'administrator').length}</p>
                          </div>
                          <svg className="w-8 h-8 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                      </div>

                      <div className="bg-yellow-500 rounded-xl p-6 text-white">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-yellow-200 text-sm font-medium">Pharmacists</p>
                            <p className="text-3xl font-bold">{users.filter(u => u.role === 'pharmacist').length}</p>
                          </div>
                          <svg className="w-8 h-8 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                            <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 102 0V3h2v1a1 1 0 102 0V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>

                      <div className="bg-purple-500 rounded-xl p-6 text-white">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-purple-200 text-sm font-medium">Administrators</p>
                            <p className="text-3xl font-bold">{users.filter(u => u.role === 'administrator').length}</p>
                          </div>
                          <svg className="w-8 h-8 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">Create New User</h4>
                            <p className="text-sm text-gray-500">Add new staff members to the system</p>
                            <button 
                              onClick={() => setShowCreateUser(true)}
                              className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              Create User
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">Manage Users</h4>
                            <p className="text-sm text-gray-500">View and edit existing user accounts</p>
                            <button 
                              onClick={() => setActiveSection('users')}
                              className="mt-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              View Users
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">System Settings</h4>
                            <p className="text-sm text-gray-500">Configure system preferences</p>
                            <button 
                              onClick={() => setActiveSection('settings')}
                              className="mt-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              View Settings
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* System Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">System Information</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <h4 className="font-semibold text-gray-900 mb-4">Recent Activity</h4>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-900">New user registered</p>
                              <p className="text-xs text-gray-500">2 minutes ago</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-900">System backup completed</p>
                              <p className="text-xs text-gray-500">1 hour ago</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-900">User role updated</p>
                              <p className="text-xs text-gray-500">3 hours ago</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <h4 className="font-semibold text-gray-900 mb-4">System Status</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Database</span>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm text-green-600 font-medium">Online</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Authentication</span>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm text-green-600 font-medium">Active</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Storage</span>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              <span className="text-sm text-yellow-600 font-medium">78% Used</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">API</span>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm text-green-600 font-medium">Responsive</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* User Management Section */}
              {activeSection === 'users' && (
                <div className="space-y-6">
                  {/* Header with Stats and Create Button */}
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
                    <div className="flex justify-between items-center">
                      <div>
                        <h1 className="text-3xl font-bold mb-2">User Management</h1>
                        <p className="text-indigo-100 text-lg">Manage all user accounts, roles, and permissions</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{users.length}</div>
                        <div className="text-indigo-200 text-sm">Total Users</div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                      </div>
                    </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500">Total Users</p>
                          <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                    </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500">Active Users</p>
                          <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.is_active).length}</p>
                  </div>
                </div>
              </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 102 0V3h2v1a1 1 0 102 0V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500">Pharmacists</p>
                          <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role === 'pharmacist').length}</p>
                  </div>
                </div>
              </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                    </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500">Administrators</p>
                          <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role === 'administrator').length}</p>
                  </div>
                </div>
              </div>
            </div>

                  {/* Search and Create Section */}
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                      <div className="flex-1 max-w-lg">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search users by name, email, or role..."
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                          </svg>
                          Filter
                        </button>
                  <button
                    onClick={() => setShowCreateUser(true)}
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg text-sm font-semibold flex items-center transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add New User
                  </button>
                      </div>
                    </div>
                </div>

                  {/* Enhanced Users Table */}
                  <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                  {users.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-2.239" />
                      </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                        <p className="text-gray-500 mb-6">Get started by creating the first user account.</p>
                        <button
                          onClick={() => setShowCreateUser(true)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors"
                        >
                          Create First User
                        </button>
                    </div>
                  ) : (
                      <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Contact Information
                          </th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Role & Status
                          </th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Activity
                          </th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                    <div className="flex-shrink-0 h-12 w-12">
                                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                                        <span className="text-sm font-semibold text-white">
                                   {user.first_name?.[0]}{user.last_name?.[0]}
                                 </span>
                               </div>
                             </div>
                             <div className="ml-4">
                                      <div className="text-sm font-semibold text-gray-900">
                                 {user.first_name} {user.last_name}
                               </div>
                               <div className="text-sm text-gray-500">
                                 @{user.username}
                               </div>
                              </div>
                            </div>
                          </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{user.email}</div>
                                  <div className="text-sm text-gray-500">{user.phone || 'No phone provided'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex flex-col space-y-2">
                                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                             user.role === 'administrator' 
                               ? 'bg-purple-100 text-purple-800'
                               : user.role === 'pharmacist'
                               ? 'bg-green-100 text-green-800'
                               : user.role === 'c-level'
                               ? 'bg-blue-100 text-blue-800'
                               : 'bg-gray-100 text-gray-800'
                           }`}>
                             {user.role || 'staff'}
                           </span>
                                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                             user.is_active 
                               ? 'bg-green-100 text-green-800'
                               : 'bg-red-100 text-red-800'
                           }`}>
                             {user.is_active ? 'Active' : 'Inactive'}
                           </span>
                                  </div>
                          </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never logged in'}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Created {new Date(user.created_at).toLocaleDateString()}
                                  </div>
                          </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex space-x-2">
                                    <button 
                                      onClick={() => handleEditUser(user)}
                                      className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors flex items-center"
                                    >
                                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                               Edit
                             </button>
                             {user.role !== 'administrator' && (
                               <button 
                                 onClick={() => handleDeleteUser(user.id)}
                                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors flex items-center"
                               >
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                 Delete
                               </button>
                             )}
                                  </div>
                           </td>
                        </tr>
                                              ))}
                      </tbody>
                    </table>
                      </div>
                  )}
                </div>
              </div>
              )}

              {/* Checklist Management Section */}
              {activeSection === 'checklists' && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-white">
                    <div className="flex justify-between items-center">
                      <div>
                        <h1 className="text-3xl font-bold mb-2">Checklist Management</h1>
                        <p className="text-green-100 text-lg">Create and manage daily checklists for staff</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{folders.length}</div>
                        <div className="text-green-200 text-sm">Active Folders</div>
                      </div>
                    </div>
                  </div>

                  {!selectedFolder ? (
                    <>
                      {/* Quick Actions - Only show when no folder selected */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </div>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500">Create New</p>
                          <p className="text-2xl font-bold text-gray-900">Folder</p>
                        </div>
                      </div>
                                             <button 
                         onClick={() => setShowCreateFolder(true)}
                         className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                         Add Folder
                       </button>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500">View</p>
                          <p className="text-2xl font-bold text-gray-900">Progress</p>
                        </div>
                      </div>
                                                <button 
                        onClick={() => setActiveSection('monitoring')}
                        className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        View Reports
                      </button>
                    </div>
                  </div>

                      {/* Folders Grid - Main View */}
                     <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 bg-blue-50">
                          <h3 className="text-xl font-semibold text-gray-900">Checklist Folders</h3>
                          <p className="text-sm text-gray-500 mt-1">Organize your checklists into folders</p>
                       </div>
                       
                        <div className="p-6">
                         {folders.length === 0 ? (
                            <div className="text-center py-16">
                              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                               </svg>
                             </div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-2">No folders yet</h4>
                              <p className="text-gray-500 mb-6">Create your first folder to organize checklists</p>
                             <button 
                               onClick={() => setShowCreateFolder(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium">
                                Create First Folder
                             </button>
                           </div>
                         ) : (
                                                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                             {folders.map((folder) => (
                               <div
                                 key={folder.id}
                                   className="bg-gray-50 hover:bg-gray-100 rounded-xl p-6 transition-all duration-200 border-2 border-transparent hover:border-blue-200 hover:shadow-md group"
                               >
                                   <div className="flex items-start space-x-4">
                                   <div 
                                       className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm cursor-pointer"
                                     style={{ backgroundColor: folder.color }}
                                       onClick={() => handleFolderSelect(folder)}
                                     >
                                       <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                       </svg>
                                     </div>
                                     <div className="flex-1" onClick={() => handleFolderSelect(folder)}>
                                       <h4 className="font-semibold text-gray-900 text-lg mb-2 cursor-pointer">{folder.name}</h4>
                                     {folder.description && (
                                         <p className="text-sm text-gray-500 mb-3 cursor-pointer">{folder.description}</p>
                                     )}
                                       <div className="flex items-center text-xs text-gray-400 cursor-pointer">
                                         <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                         </svg>
                                         Click to view checklists
                                       </div>
                                     </div>
                                     <div className="flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                       <button
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           setEditingFolder(folder);
                                           setShowEditFolder(true);
                                         }}
                                         className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                         title="Edit folder"
                                       >
                                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                         </svg>
                                       </button>
                                       <button
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           handleDeleteFolder(folder.id, folder.name);
                                         }}
                                         className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                         title="Delete folder"
                                       >
                                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                         </svg>
                                       </button>
                                   </div>
                                 </div>
                               </div>
                             ))}
                           </div>
                         )}
                       </div>
                     </div>
                    </>
                  ) : (
                    /* Folder Detail View - Shows when folder is selected */
                    <div className="space-y-6">
                      {/* Back button and folder info */}
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => {
                            setSelectedFolder(null);
                            setSelectedChecklist(null);
                            setChecklists([]);
                          }}
                          className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 bg-white rounded-lg px-4 py-2 border border-gray-200 hover:border-gray-300 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          <span>Back to Folders</span>
                        </button>
                        
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-8 h-8 rounded-lg"
                            style={{ backgroundColor: selectedFolder.color }}
                          ></div>
                          <div>
                            <h3 className="text-xl font-semibold text-gray-900">{selectedFolder.name}</h3>
                            <p className="text-sm text-gray-500">{selectedFolder.description}</p>
                          </div>
                        </div>
                      </div>

                      {/* Checklists in selected folder */}
                     <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 bg-green-50">
                          <div className="flex justify-between items-center">
                            <div>
                         <h3 className="text-lg font-semibold text-gray-900">Checklists</h3>
                              <p className="text-sm text-gray-500 mt-1">Manage checklists in this folder</p>
                       </div>
                            <button 
                              onClick={() => setShowCreateChecklist(true)}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                               </svg>
                              <span>Add Checklist</span>
                            </button>
                             </div>
                           </div>
                        
                        <div className="p-6">
                          {checklists.length === 0 ? (
                            <div className="text-center py-16">
                              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                               </svg>
                             </div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-2">No checklists in this folder</h4>
                              <p className="text-gray-500 mb-6">Create your first checklist for this folder</p>
                             <button 
                               onClick={() => setShowCreateChecklist(true)}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium">
                                Create First Checklist
                             </button>
                           </div>
                         ) : (
                                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             {checklists.map((checklist) => (
                               <div
                                 key={checklist.id}
                                   className="bg-gray-50 hover:bg-gray-100 rounded-xl p-6 transition-all duration-200 border-2 border-transparent hover:border-green-200 hover:shadow-md group"
                                 >
                                   <div className="flex justify-between items-start mb-3">
                                     <h4 
                                       className="font-semibold text-gray-900 text-lg cursor-pointer flex-1"
                                 onClick={() => handleChecklistSelect(checklist)}
                                     >
                                       {checklist.name}
                                     </h4>
                                     <div className="flex items-center space-x-2">
                                       <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                         checklist.is_daily 
                                           ? 'bg-blue-100 text-blue-800' 
                                           : 'bg-gray-100 text-gray-800'
                                       }`}>
                                         {checklist.is_daily ? 'Daily' : 'One-time'}
                                     </span>
                                       <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             setEditingChecklist(checklist);
                                             setShowEditChecklist(true);
                                           }}
                                           className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                           title="Edit checklist"
                                         >
                                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                           </svg>
                                         </button>
                                         <button
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             handleDeleteChecklist(checklist.id, checklist.name);
                                           }}
                                           className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                           title="Delete checklist"
                                         >
                                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                           </svg>
                                         </button>
                                 </div>
                               </div>
                           </div>
                                   
                                   {checklist.description && (
                                     <p 
                                       className="text-sm text-gray-500 mb-3 cursor-pointer"
                                       onClick={() => handleChecklistSelect(checklist)}
                                     >
                                       {checklist.description}
                                     </p>
                                   )}
                                   
                                   <div className="flex items-center justify-between">
                                     <div 
                                       className="flex items-center space-x-2 cursor-pointer"
                                       onClick={() => handleChecklistSelect(checklist)}
                                     >
                                       <span className="text-xs text-gray-400">Assigned:</span>
                                       <div className="flex space-x-1">
                                         <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                           {checklist.target_users?.length || 0} users
                                         </span>
                       </div>
                     </div>

                                      <button 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setSelectedChecklist(checklist);
                                          await loadChecklistItems(checklist.id);
                                          setShowManageItems(true);
                                        }}
                                       className="text-green-600 hover:text-green-700 text-sm font-medium"
                                     >
                                       Manage Tasks
                             </button>
                         </div>
                       </div>
                               ))}
                             </div>
                          )}
                           </div>
                             </div>
                           </div>
                                     )}
                                   </div>
              )}

                              {/* Monitoring Section */}
                {activeSection === 'monitoring' && (
                  <div className="space-y-8">
                    {/* Modern Header */}
                    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-2xl p-8 text-white shadow-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white to-indigo-100 bg-clip-text text-transparent">
                            Employee Progress Monitoring
                          </h1>
                          <p className="text-indigo-100 text-lg font-medium">
                            Real-time tracking with detailed task visibility
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-5xl font-bold mb-2">{allUsersProgress.length}</div>
                          <div className="text-indigo-200 text-sm uppercase tracking-wide">Total Assignments</div>
                        </div>
                      </div>

                      
                      {/* Embedded Stats Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-8">
                        <div className="bg-white/20 backdrop-blur rounded-xl p-6 border border-white/30">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-lg">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div>
                              <div className="text-3xl font-bold text-white">
                                {allUsersProgress.filter(p => p.is_fully_completed).length}
                              </div>
                              <div className="text-indigo-200 text-sm font-medium">Completed</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white/20 backdrop-blur rounded-xl p-6 border border-white/30">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <div className="text-3xl font-bold text-white">
                                {allUsersProgress.filter(p => p.completed_items > 0 && !p.is_fully_completed).length}
                              </div>
                              <div className="text-indigo-200 text-sm font-medium">In Progress</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white/20 backdrop-blur rounded-xl p-6 border border-white/30">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center shadow-lg">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <div className="text-3xl font-bold text-white">
                                {allUsersProgress.filter(p => p.completed_items === 0).length}
                              </div>
                              <div className="text-indigo-200 text-sm font-medium">Not Started</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white/20 backdrop-blur rounded-xl p-6 border border-white/30">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <div>
                              <div className="text-3xl font-bold text-white">
                                {allUsersProgress.length > 0 
                                  ? Math.round(allUsersProgress.reduce((acc, p) => acc + p.completion_percentage, 0) / allUsersProgress.length)
                                  : 0}%
                              </div>
                              <div className="text-indigo-200 text-sm font-medium">Average</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-6">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Select Date
                            </label>
                            <input
                              type="date"
                              value={monitoringDate}
                              onChange={(e) => setMonitoringDate(e.target.value)}
                              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                            />
                          </div>
                          <div className="pt-6">
                            {monitoringDate === new Date().toISOString().split('T')[0] ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                                Live Updates
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                                Historical Data
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-500 font-medium">
                            {new Set(allUsersProgress.map(p => p.user_id)).size} employees tracked
                          </span>
                          <button
                            onClick={loadAllUsersProgress}
                            disabled={isRefreshing}
                            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                              isRefreshing 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
                            }`}
                          >
                            <svg 
                              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
                          </button>
                          {monitoringDate !== new Date().toISOString().split('T')[0] && (
                            <button
                              onClick={() => setMonitoringDate(new Date().toISOString().split('T')[0])}
                              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-md"
                            >
                              View Today
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Branch-Based Monitoring */}
                    {!selectedBranchForMonitoring ? (
                      /* Branch Selection View */
                      branches.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-3">No Branches Found</h3>
                          <p className="text-gray-500 mb-6">Create pharmacy branches to monitor staff progress.</p>
                          <button
                            onClick={() => setActiveSection('branches')}
                            className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md"
                          >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create First Branch
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select a Branch to Monitor</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {branches.map((branch) => {
                                // Calculate staff progress for this branch
                                const branchProgress = allUsersProgress.filter(progress => progress.branch_id === branch.id);
                                
                                const totalStaff = new Set(branchProgress.map(p => p.user_id)).size;
                                const completedAssignments = branchProgress.filter(p => p.is_fully_completed).length;
                                const totalAssignments = branchProgress.length;
                                const avgCompletion = totalAssignments > 0 
                                  ? branchProgress.reduce((sum, p) => sum + p.completion_percentage, 0) / totalAssignments 
                                  : 0;

                                return (
                                  <div
                                    key={branch.id}
                                    onClick={() => handleBranchMonitoringSelect(branch)}
                                    className="border-2 border-gray-200 rounded-xl p-6 cursor-pointer hover:border-indigo-300 hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-white to-gray-50"
                                  >
                                    <div className="flex items-center space-x-4 mb-4">
                                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-gray-900 text-lg">{branch.branch_name}</h4>
                                        <p className="text-sm text-gray-500">{branch.branch_code} • {branch.city}</p>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                                      <div>
                                        <div className="text-2xl font-bold text-indigo-600">{Math.round(avgCompletion)}%</div>
                                        <div className="text-xs text-gray-500">Avg Completion</div>
                                      </div>
                                      <div>
                                        <div className="text-2xl font-bold text-gray-900">{totalStaff}</div>
                                        <div className="text-xs text-gray-500">Staff</div>
                                      </div>
                                      <div>
                                        <div className="text-2xl font-bold text-gray-900">{completedAssignments}/{totalAssignments}</div>
                                        <div className="text-xs text-gray-500">Completed</div>
                                      </div>
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{branch.branch_type}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      /* Branch Staff Progress View */
                      <div className="space-y-6">
                        {/* Back Button and Branch Header */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <button
                              onClick={handleBackToBranchList}
                              className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                              <span>Back to Branches</span>
                            </button>
                            <div className="text-right">
                              <h3 className="text-xl font-bold text-gray-900">{selectedBranchForMonitoring.branch_name}</h3>
                              <p className="text-sm text-gray-500">{selectedBranchForMonitoring.branch_code} • {selectedBranchForMonitoring.city}</p>
                            </div>
                          </div>
                          
                          {/* Branch Staff Summary */}
                          <div className="grid grid-cols-4 gap-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-indigo-600">
                                {new Set(branchStaffProgress.map(p => p.user_id)).size}
                              </div>
                              <div className="text-sm text-gray-600">Staff Members</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">
                                {branchStaffProgress.filter(p => p.is_fully_completed).length}
                              </div>
                              <div className="text-sm text-gray-600">Completed</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-orange-600">
                                {branchStaffProgress.filter(p => p.completed_items > 0 && !p.is_fully_completed).length}
                              </div>
                              <div className="text-sm text-gray-600">In Progress</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-purple-600">
                                {branchStaffProgress.length > 0 
                                  ? Math.round(branchStaffProgress.reduce((sum, p) => sum + p.completion_percentage, 0) / branchStaffProgress.length)
                                  : 0}%
                              </div>
                              <div className="text-sm text-gray-600">Average</div>
                            </div>
                          </div>
                        </div>

                        {/* Staff Progress Cards */}
                        {branchStaffProgress.length === 0 ? (
                          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                              </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">No Staff Progress Data</h3>
                            <p className="text-gray-500 mb-6">No checklist assignments found for staff in this branch.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {Object.entries(
                              branchStaffProgress.reduce((acc, progress) => {
                                const userId = progress.user_id;
                                if (!acc[userId]) {
                                  acc[userId] = {
                                    user: progress.user,
                                    checklists: []
                                  };
                                }
                                acc[userId].checklists.push(progress);
                                return acc;
                              }, {} as Record<string, { user: any, checklists: any[] }>)
                            )
                            .sort(([, a], [, b]) => {
                              const aCompletion = a.checklists.reduce((sum, c) => sum + c.completion_percentage, 0) / a.checklists.length;
                              const bCompletion = b.checklists.reduce((sum, c) => sum + c.completion_percentage, 0) / b.checklists.length;
                              if (bCompletion !== aCompletion) return bCompletion - aCompletion;
                              return `${a.user?.first_name} ${a.user?.last_name}`.localeCompare(`${b.user?.first_name} ${b.user?.last_name}`);
                            })
                            .map(([userId, userData]) => {
                              const completedCount = userData.checklists.filter(c => c.is_fully_completed).length;
                              const totalCount = userData.checklists.length;
                              const avgCompletion = userData.checklists.reduce((sum, c) => sum + c.completion_percentage, 0) / totalCount;
                              
                              return (
                                <EmployeeProgressCard 
                                  key={userId}
                                  userData={userData}
                                  completedCount={completedCount}
                                  totalCount={totalCount}
                                  avgCompletion={avgCompletion}
                                  folders={folders}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
              )}

              {/* Payslip Management Section */}
              {activeSection === 'payslips' && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-white">
                    <div className="flex justify-between items-center">
                      <div>
                        <h1 className="text-3xl font-bold mb-2">Payslip Management</h1>
                        <p className="text-green-100 text-lg">View and manage employee payslips by branch and month</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{payslipData.reduce((total, branch) => total + branch.employees.length, 0)}</div>
                        <div className="text-green-200 text-sm">Total Employees</div>
                      </div>
                    </div>
                  </div>

                  {/* Month Selector */}
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Select Month</h3>
                      <input
                        type="month"
                        value={currentMonth}
                        onChange={(e) => setCurrentMonth(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {loadingPayslips ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                      <span className="ml-4 text-gray-600">Loading payslip data...</span>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {payslipData.filter(branchData => branchData.employees.length > 0).map((branchData, index) => (
                        <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">{branchData.branch.branch_name || branchData.branch.name}</h3>
                                <p className="text-sm text-gray-600">{branchData.employees.length} employees</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <span className="text-sm font-medium text-blue-700">Branch</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pay</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                              </thead>
                                                              <tbody className="bg-white divide-y divide-gray-200">
                                {branchData.employees.map((employee, empIndex) => (
                                  <tr key={empIndex} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-sm">
                                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                          </svg>
                                        </div>
                                        <div className="ml-4">
                                          <div className="text-sm font-medium text-gray-900">
                                            {employee.first_name || 'Unknown'} {employee.last_name || 'User'}
                                          </div>
                                          <div className="text-sm text-gray-500">{employee.email || 'No email'}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {employee.position || 'Staff'}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-semibold text-blue-600">{formatHoursMinutes(employee.totalScheduledHours || 0)}</div>
                                      <div className="text-xs text-gray-500">Scheduled</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-semibold text-gray-900">{formatHoursMinutes(employee.totalHours || 0)}</div>
                                      {employee.totalBreakHours > 0 && (
                                        <div className="text-xs text-gray-500">(-{formatHoursMinutes(employee.totalBreakHours)} breaks)</div>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      {employee.totalScheduledHours > 0 ? (
                                        <>
                                          {employee.overtimeHours > 0 ? (
                                            <div className="text-sm font-semibold text-orange-600">{formatHoursMinutes(employee.overtimeHours)}</div>
                                          ) : (
                                            <div className="text-sm text-gray-400">0h</div>
                                          )}
                                          <div className="text-xs text-gray-500">Not paid</div>
                                        </>
                                      ) : (
                                        <>
                                          <div className="text-sm text-gray-400">N/A</div>
                                          <div className="text-xs text-gray-500">No schedule</div>
                                        </>
                                      )}
                                    </td>
                                     <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-semibold text-green-600">£{employee.totalPay.toFixed(2)}</div>
                                        <div className="text-xs text-gray-500">
                                          £{(employee.pay_rate || 12.00).toFixed(2)}/hr × {formatHoursMinutes(employee.totalHours || 0)}
                                          {employee.totalHours > 0 && employee.totalHours < 0.1 && (
                                            <div className="text-blue-600">
                                              (£{((employee.pay_rate || 12.00) / 60).toFixed(4)}/min)
                                            </div>
                                          )}
                                        </div>
                                     </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      <button
                                        onClick={() => {
                                          setSelectedEmployee(employee);
                                          setShowEmployeeDetails(true);
                                        }}
                                        className="inline-flex items-center px-3 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                                      >
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        View Details
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Branch Management Section */}
              {activeSection === 'branches' && (
                <div className="space-y-8">
                  {/* Header */}
                                      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-8 text-white relative overflow-hidden">
                      <div className="relative z-10">
                        <h1 className="text-3xl font-bold mb-2">Branch Management</h1>
                        <p className="text-orange-100 text-lg">Manage multiple pharmacy branches, locations, and staff assignments</p>
                    </div>
                    <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                      <div className="w-40 h-40 bg-white bg-opacity-10 rounded-full flex items-center justify-center">
                        <svg className="w-20 h-20 text-white opacity-50" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Branch Selection */}
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">Pharmacy Branches</h3>
                      <button 
                        onClick={() => setShowCreateBranch(true)}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Add New Branch</span>
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {branches.length === 0 ? (
                        <div className="text-center py-8 col-span-full">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">No Branches Found</h4>
                          <p className="text-gray-500 mb-4">Create your first pharmacy branch to get started</p>
                          <button 
                            onClick={() => setShowCreateBranch(true)}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                          >
                            Create First Branch
                          </button>
                        </div>
                      ) : (
                        branches.map((branch) => (
                          <BranchCard
                            key={branch.id}
                            branch={branch}
                            onManageStaff={() => {
                              setSelectedBranch(branch);
                              setShowAssignStaff(true);
                            }}
                            onViewDetails={() => {
                              setSelectedBranch(branch);
                              setShowBranchDetails(true);
                            }}
                            onTimeManagement={() => {
                              setSelectedBranchForTime(branch);
                              setShowTimeManagement(true);
                            }}
                            onSetLocation={() => {
                              setSelectedBranch(branch);
                              setShowLocationPicker(true);
                            }}
                            activeStaffCount={branchStaffCounts[branch.id]?.active || 0}
                            onBreakCount={branchStaffCounts[branch.id]?.onBreak || 0}
                            totalStaffCount={branchStaffCounts[branch.id]?.total || 0}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Branch Performance Overview */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">Branch Performance Overview</h3>
                      <p className="text-sm text-gray-500 mt-1">Checklist completion rates and SOP compliance by branch</p>
                    </div>
                    
                    <div className="p-6">
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">No Performance Data</h4>
                        <p className="text-gray-500">Performance metrics will appear here once branches are created and staff assigned</p>
                      </div>
                    </div>
                  </div>



                  {/* Quick Actions */}
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button 
                        onClick={() => setShowCreateBranch(true)}
                        className="flex items-center justify-center space-x-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-6 py-4 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span>Add New Branch</span>
                      </button>
                      
                      <button 
                        onClick={() => setActiveSection('sop')}
                        className="flex items-center justify-center space-x-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-4 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span>Manage SOPs</span>
                      </button>
                      
                      <button 
                        onClick={() => setActiveSection('monitoring')}
                        className="flex items-center justify-center space-x-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-4 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>View Reports</span>
                      </button>
                    </div>
                  </div>

                  {/* Time Management Modal */}
                  {showTimeManagement && selectedBranchForTime && (
                    <BranchTimeManagement
                      branch={selectedBranchForTime}
                      staff={branchStaff}
                      onClose={() => {
                        setShowTimeManagement(false);
                        setSelectedBranchForTime(null);
                        loadBranchStaffCounts(selectedBranchForTime.id);
                      }}
                    />
                  )}
                </div>
              )}

              {/* SOP Management Section */}
              {activeSection === 'sop' && (
                <div className="space-y-8">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-white relative overflow-hidden">
                    <div className="relative z-10">
                      <h1 className="text-3xl font-bold mb-2">Standard Operating Procedures</h1>
                      <p className="text-green-100 text-lg">Create and manage pharmacy SOPs and compliance documentation</p>
                    </div>
                    <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                      <div className="w-40 h-40 bg-white bg-opacity-10 rounded-full flex items-center justify-center">
                        <svg className="w-20 h-20 text-white opacity-50" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* SOP Categories */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 7.172V5L8 4z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Medication Handling</h3>
                          <p className="text-sm text-gray-500">0 procedures</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Procedures for safe medication dispensing, storage, and inventory management.</p>
                      <button className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-2 px-4 rounded-lg transition-colors">
                        View Procedures
                      </button>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Safety & Compliance</h3>
                          <p className="text-sm text-gray-500">0 procedures</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Safety protocols, regulatory compliance, and emergency procedures.</p>
                      <button className="w-full bg-green-50 hover:bg-green-100 text-green-700 font-medium py-2 px-4 rounded-lg transition-colors">
                        View Procedures
                      </button>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Customer Service</h3>
                          <p className="text-sm text-gray-500">0 procedures</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Customer interaction protocols, consultation procedures, and service standards.</p>
                      <button className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium py-2 px-4 rounded-lg transition-colors">
                        View Procedures
                      </button>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Quality Control</h3>
                          <p className="text-sm text-gray-500">0 procedures</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Quality assurance, validation processes, and accuracy verification procedures.</p>
                      <button className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-2 px-4 rounded-lg transition-colors">
                        View Procedures
                      </button>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Operational Procedures</h3>
                          <p className="text-sm text-gray-500">0 procedures</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Daily operations, opening/closing procedures, and system maintenance.</p>
                      <button className="w-full bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-medium py-2 px-4 rounded-lg transition-colors">
                        View Procedures
                      </button>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Emergency Procedures</h3>
                          <p className="text-sm text-gray-500">0 procedures</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Emergency response protocols, incident reporting, and crisis management.</p>
                      <button className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-medium py-2 px-4 rounded-lg transition-colors">
                        View Procedures
                      </button>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button className="flex items-center justify-center space-x-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-4 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Create New SOP</span>
                      </button>
                      
                      <button className="flex items-center justify-center space-x-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-4 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>Import SOPs</span>
                      </button>
                      
                      <button className="flex items-center justify-center space-x-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-4 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Generate Report</span>
                      </button>
                    </div>
                  </div>

                  {/* No SOPs Created Yet */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">Standard Operating Procedures</h3>
                      <p className="text-sm text-gray-500 mt-1">Manage your pharmacy's SOPs and compliance documentation</p>
                    </div>
                    
                    <div className="p-6">
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">No SOPs Created Yet</h4>
                        <p className="text-gray-500 mb-6">Start building your pharmacy's standard operating procedures to ensure consistent operations</p>
                        <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                          Create First SOP
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Holidays Section */}
              {activeSection === 'holidays' && (
                <div className="space-y-6">
                  <HolidayManagement />
                </div>
              )}

              {/* Password Manager Section */}
              {activeSection === 'passwords' && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-8 text-white">
                    <div className="flex justify-between items-center">
                      <div>
                        <h1 className="text-3xl font-bold mb-2">Password Manager</h1>
                        <p className="text-red-100 text-lg">Securely manage and share credentials across your organization</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{passwordFolders.length}</div>
                        <div className="text-red-200 text-sm">Active Folders</div>
                      </div>
                    </div>
                  </div>

                  {!selectedPasswordFolder ? (
                    <>
                      {/* Quick Actions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                              </div>
                            </div>
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-500">Create New</p>
                              <p className="text-2xl font-bold text-gray-900">Folder</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setShowCreatePasswordFolder(true)}
                            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            Add Folder
                          </button>
                        </div>

                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                              </div>
                            </div>
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-500">Security</p>
                              <p className="text-2xl font-bold text-gray-900">Strong</p>
                            </div>
                          </div>
                          <div className="mt-4 text-sm text-gray-600">
                            All passwords are encrypted and secured
                          </div>
                        </div>
                      </div>

                      {/* Password Folders Grid */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 bg-red-50">
                          <h3 className="text-xl font-semibold text-gray-900">Password Folders</h3>
                          <p className="text-sm text-gray-500 mt-1">Organize your credentials into secure folders</p>
                        </div>
                        
                        <div className="p-6">
                          {loadingPasswords ? (
                            <div className="text-center py-16">
                              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                              <p className="mt-4 text-gray-600">Loading password folders...</p>
                            </div>
                          ) : passwordFolders.length === 0 ? (
                            <div className="text-center py-16">
                              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                              </div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-2">No password folders yet</h4>
                              <p className="text-gray-500 mb-6">Create your first folder to organize credentials</p>
                              <button 
                                onClick={() => setShowCreatePasswordFolder(true)}
                                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium">
                                Create First Folder
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {passwordFolders.map((folder) => (
                                <div
                                  key={folder.id}
                                  className="bg-gray-50 hover:bg-gray-100 rounded-xl p-6 transition-all duration-200 border-2 border-transparent hover:border-red-200 hover:shadow-md group cursor-pointer"
                                  onClick={() => handlePasswordFolderSelect(folder)}
                                >
                                  <div className="flex items-start space-x-4">
                                    <div 
                                      className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
                                      style={{ backgroundColor: folder.color }}
                                    >
                                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                      </svg>
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-gray-900 text-lg mb-2">{folder.name}</h4>
                                      {folder.description && (
                                        <p className="text-sm text-gray-500 mb-3">{folder.description}</p>
                                      )}
                                      <div className="flex items-center text-xs text-gray-400">
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                        {folder.password_count || 0} passwords
                                      </div>
                                    </div>
                                    <div className="flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditPasswordFolder(folder);
                                        }}
                                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                        title="Edit folder"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeletePasswordFolder(folder.id, folder.name);
                                        }}
                                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                        title="Delete folder"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Password Folder Detail View */
                    <div className="space-y-6">
                      {/* Back button and folder info */}
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => {
                            setSelectedPasswordFolder(null);
                            setSelectedPasswordEntry(null);
                            setPasswordEntries([]);
                          }}
                          className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 bg-white rounded-lg px-4 py-2 border border-gray-200 hover:border-gray-300 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          <span>Back to Folders</span>
                        </button>
                        
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-8 h-8 rounded-lg"
                            style={{ backgroundColor: selectedPasswordFolder.color }}
                          ></div>
                          <div>
                            <h3 className="text-xl font-semibold text-gray-900">{selectedPasswordFolder.name}</h3>
                            <p className="text-sm text-gray-500">{selectedPasswordFolder.description}</p>
                          </div>
                        </div>
                      </div>

                      {/* Password Entries in selected folder */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 bg-orange-50">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">Password Entries</h3>
                              <p className="text-sm text-gray-500 mt-1">Manage passwords in this folder</p>
                            </div>
                            <button 
                              onClick={() => setShowCreatePasswordEntry(true)}
                              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              <span>Add Password</span>
                            </button>
                          </div>
                        </div>
                        
                        <div className="p-6">
                          {passwordEntries.length === 0 ? (
                            <div className="text-center py-16">
                              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                              </div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-2">No passwords in this folder</h4>
                              <p className="text-gray-500 mb-6">Create your first password entry for this folder</p>
                              <button 
                                onClick={() => setShowCreatePasswordEntry(true)}
                                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium">
                                Create First Password
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {passwordEntries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="bg-gray-50 hover:bg-gray-100 rounded-xl p-6 transition-all duration-200 border-2 border-transparent hover:border-orange-200 hover:shadow-md group cursor-pointer"
                                  onClick={() => handlePasswordEntrySelect(entry)}
                                >
                                  <div className="flex justify-between items-start mb-3">
                                    <h4 className="font-semibold text-gray-900 text-lg flex-1">
                                      {entry.name}
                                    </h4>
                                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditPasswordEntry(entry);
                                        }}
                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                        title="Edit password"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeletePasswordEntry(entry.id, entry.name);
                                        }}
                                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                        title="Delete password"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2 text-sm">
                                    {entry.website_name && (
                                      <div className="flex items-center text-gray-600">
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-3a5 5 0 00-5-5 5 5 0 00-5 5v3m9-9v-3a5 5 0 00-5-5 5 5 0 00-5 5v3" />
                                        </svg>
                                        {entry.website_name}
                                      </div>
                                    )}
                                    {entry.email && (
                                      <div className="flex items-center text-gray-600">
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                        </svg>
                                        {entry.email}
                                      </div>
                                    )}
                                    {entry.username && (
                                      <div className="flex items-center text-gray-600">
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        {entry.username}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center justify-between mt-4">
                                    <span className="text-xs text-gray-400">Click to view details</span>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPasswordEntry(entry);
                                        setShowSharePassword(true);
                                      }}
                                      className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                                    >
                                      Share
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Settings Section */}
              {activeSection === 'settings' && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
            </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">System Settings</h3>
                  <p className="text-gray-500">Coming soon - Configure system settings and preferences</p>
                </div>
              )}
          </div>
        </main>
        </div>

        {/* Create User Modal */}
        {showCreateUser && (
          <CreateUserModal 
            onClose={() => setShowCreateUser(false)} 
            onUserCreated={loadUsers}
          />
        )}

        {/* Edit User Modal */}
        {showEditUser && editingUser && (
          <EditUserModal 
            user={editingUser}
            onClose={() => {
              setShowEditUser(false);
              setEditingUser(null);
            }} 
            onUserUpdated={handleUpdateUser}
          />
        )}

        {/* Create Folder Modal */}
        {showCreateFolder && (
          <CreateFolderModal 
            onClose={() => setShowCreateFolder(false)} 
            onFolderCreated={loadFolders}
          />
        )}

        {/* Create Checklist Modal */}
        {showCreateChecklist && (
          <CreateChecklistModal 
            selectedFolder={selectedFolder}
            onClose={() => setShowCreateChecklist(false)} 
            onChecklistCreated={() => {
              loadChecklists(selectedFolder?.id);
              loadFolders();
            }}
          />
        )}

        {/* Manage Items Modal */}
        {showManageItems && selectedChecklist && (
          <ManageItemsModal 
            checklist={selectedChecklist}
            items={checklistItems}
            onClose={() => setShowManageItems(false)} 
            onItemsUpdated={() => loadChecklistItems(selectedChecklist.id)}
          />
        )}

        {/* Edit Folder Modal */}
        {showEditFolder && editingFolder && (
          <EditFolderModal 
            folder={editingFolder}
            onClose={() => {
              setShowEditFolder(false);
              setEditingFolder(null);
            }} 
            onFolderUpdated={loadFolders}
          />
        )}

        {/* Edit Checklist Modal */}
        {showEditChecklist && editingChecklist && (
          <EditChecklistModal 
            checklist={editingChecklist}
            onClose={() => {
              setShowEditChecklist(false);
              setEditingChecklist(null);
            }} 
            onChecklistUpdated={() => {
              if (selectedFolder) {
                loadChecklists(selectedFolder.id);
              }
            }}
          />
        )}

        {/* Create Branch Modal */}
        {showCreateBranch && (
          <CreateBranchModal 
            onClose={() => setShowCreateBranch(false)}
            onBranchCreated={() => {
              loadBranches();
              setShowCreateBranch(false);
            }}
          />
        )}

        {/* Edit Branch Modal */}
        {showEditBranch && editingBranch && (
          <EditBranchModal 
            branch={editingBranch}
            onClose={() => {
              setShowEditBranch(false);
              setEditingBranch(null);
            }}
            onBranchUpdated={() => {
              loadBranches();
              setShowEditBranch(false);
              setEditingBranch(null);
            }}
          />
        )}

        {/* Assign Staff Modal */}
        {showAssignStaff && selectedBranch && (
          <AssignStaffModal 
            branchId={selectedBranch.id}
            onClose={() => {
              setShowAssignStaff(false);
              setSelectedBranch(null);
            }}
            onStaffChanged={() => {
              // Refresh branch list and staff counts
              loadBranches();
              loadBranchStaffCounts(selectedBranch.id);
              // If branch details is open, reload staff for that branch
              if (showBranchDetails && selectedBranchForDetails) {
                loadBranchStaff(selectedBranchForDetails.id);
              }
            }}
          />
        )}

        {/* Branch Details Modal */}
        {showBranchDetails && selectedBranchForDetails && (
          <BranchDetailsModal 
            branch={selectedBranchForDetails}
            staff={branchStaff}
            loadingStaff={loadingStaff}
            onClose={() => {
              setShowBranchDetails(false);
              setSelectedBranchForDetails(null);
              setBranchStaff([]);
            }}
            onAssignStaff={() => {
              setSelectedBranch(selectedBranchForDetails);
              setShowAssignStaff(true);
            }}
          />
        )}

        {/* Location Picker Modal */}
        {showLocationPicker && selectedBranch && (
          <BranchLocationPicker
            branch={selectedBranch}
            onClose={() => {
              setShowLocationPicker(false);
              setSelectedBranch(null);
            }}
            onSave={handleLocationSave}
          />
        )}

        {/* Password Manager Modals */}
        <PasswordFolderModal
          isOpen={showCreatePasswordFolder}
          onClose={() => setShowCreatePasswordFolder(false)}
          onSave={handleCreatePasswordFolder}
          mode="create"
        />

        <PasswordFolderModal
          isOpen={showEditPasswordFolder}
          onClose={() => {
            setShowEditPasswordFolder(false);
            setEditingPasswordFolder(null);
          }}
          onSave={(folderData) => {
            if (editingPasswordFolder) {
              handleUpdatePasswordFolder(editingPasswordFolder.id, folderData);
            }
          }}
          folder={editingPasswordFolder}
          mode="edit"
        />

        <EnhancedPasswordEntryModal
          isOpen={showCreatePasswordEntry}
          onClose={() => setShowCreatePasswordEntry(false)}
          onSave={handleCreatePasswordEntry}
          mode="create"
          selectedFolderId={selectedPasswordFolder?.id}
          folders={passwordFolders}
        />

        <EnhancedPasswordEntryModal
          isOpen={showEditPasswordEntry}
          onClose={() => {
            setShowEditPasswordEntry(false);
            setEditingPasswordEntry(null);
          }}
          onSave={(entryData) => {
            if (editingPasswordEntry) {
              handleUpdatePasswordEntry(editingPasswordEntry.id, entryData);
            }
          }}
          entry={editingPasswordEntry}
          mode="edit"
          selectedFolderId={selectedPasswordFolder?.id}
          folders={passwordFolders}
        />

        <PasswordDetailsModal
          isOpen={showPasswordDetails}
          onClose={() => {
            setShowPasswordDetails(false);
            setSelectedPasswordEntry(null);
          }}
          entry={selectedPasswordEntry}
          onEdit={(entry) => {
            setShowPasswordDetails(false);
            handleEditPasswordEntry(entry);
          }}
          onShare={(entry) => {
            setShowPasswordDetails(false);
            setSelectedPasswordEntry(entry);
            setShowSharePassword(true);
          }}
        />

        <PasswordShareModal
          isOpen={showSharePassword}
          onClose={() => {
            setShowSharePassword(false);
            setSelectedPasswordEntry(null);
          }}
          entry={selectedPasswordEntry}
          onSave={handleSharePassword}
        />

        {/* Employee Details Modal */}
        {showEmployeeDetails && selectedEmployee && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mb-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Payslip Details - {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </h3>
                  <button
                    onClick={() => {
                      setShowEmployeeDetails(false);
                      setSelectedEmployee(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Month: {new Date(currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Scheduled Hours</p>
                    <p className="text-2xl font-bold text-blue-600">{formatHoursMinutes(selectedEmployee.totalScheduledHours || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Paid Hours</p>
                    <p className="text-2xl font-bold text-gray-900">{formatHoursMinutes(selectedEmployee.totalHours || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Break Time</p>
                    <p className="text-2xl font-bold text-orange-600">{formatHoursMinutes(selectedEmployee.totalBreakHours || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Overtime</p>
                    {selectedEmployee.totalScheduledHours > 0 ? (
                      <>
                        <p className="text-2xl font-bold text-red-600">{formatHoursMinutes(selectedEmployee.overtimeHours || 0)}</p>
                        <p className="text-xs text-red-500">Not paid</p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-gray-400">N/A</p>
                        <p className="text-xs text-gray-500">No schedule set</p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Hourly Rate</p>
                    <p className="text-2xl font-bold text-blue-600">£{(selectedEmployee.pay_rate || 12.00).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Pay</p>
                    <p className="text-2xl font-bold text-green-600">£{selectedEmployee.totalPay.toFixed(2)}</p>
                  </div>
                </div>
                
                {/* Pay Calculation Info */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Pay Calculation</h4>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">£{(selectedEmployee.pay_rate || 12.00).toFixed(2)}/hour</span> × 
                    <span className="font-medium ml-1">{formatHoursMinutes(selectedEmployee.totalHours || 0)}</span> = 
                    <span className="font-bold text-green-600 ml-1">£{selectedEmployee.totalPay.toFixed(2)}</span>
                    <div className="text-xs text-blue-600 mt-2">
                      ℹ️ Pay calculated only for hours worked within assigned schedule times
                    </div>
                    {selectedEmployee.scheduleData && (
                      <div className="text-xs text-gray-500 mt-1">
                        Schedule: {selectedEmployee.scheduleData.dailySchedule?.map((day: any) => 
                          `${day.day.charAt(0).toUpperCase() + day.day.slice(1)} ${day.startTime}-${day.endTime}`
                        ).join(', ') || 'No schedule set'}
                      </div>
                    )}
                    {selectedEmployee.overtimeHours > 0 && selectedEmployee.totalScheduledHours > 0 && (
                      <div className="text-xs text-red-500 mt-1">
                        Note: {formatHoursMinutes(selectedEmployee.overtimeHours)} overtime hours are not included in pay calculation
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Breaks</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holiday</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedEmployee.timeEntries?.map((entry: any, index: number) => {
                      const clockIn = entry.clock_in_time ? new Date(entry.clock_in_time) : null;
                      const clockOut = entry.clock_out_time ? new Date(entry.clock_out_time) : null;
                      const payRate = selectedEmployee.pay_rate || 12.00;
                      const displayHours = entry.displayHours || 0; // Use display hours (capped at scheduled)
                      const scheduledHours = entry.scheduledHoursForDay || 0;
                      const amount = displayHours * payRate; // No overtime in display

                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {clockIn ? clockIn.toLocaleDateString() : 'N/A'}
                            {entry.combinedEntries > 1 && (
                              <div className="text-xs text-blue-600">
                                ({entry.combinedEntries} sessions)
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {clockIn ? clockIn.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {clockOut ? (
                              <div className="flex items-center space-x-2">
                                <span>{clockOut.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                {entry.autoClockOut && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                    Auto
                                  </span>
                                )}
                              </div>
                            ) : 'Not clocked out'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {entry.breaks && entry.breaks.length > 0 ? (
                              <div className="space-y-1">
                                {entry.breaks.slice(0, 3).map((breakEntry: any, breakIndex: number) => {
                                  const breakStart = breakEntry.clock_in_time ? new Date(breakEntry.clock_in_time) : null;
                                  const breakEnd = breakEntry.clock_out_time ? new Date(breakEntry.clock_out_time) : null;
                                  const breakDuration = breakStart && breakEnd ? 
                                    Math.round((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60)) : 0;
                                  
                                  return (
                                    <div key={breakIndex} className="text-xs">
                                      <span className="text-gray-600">
                                        {breakStart?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                                        {breakEnd ? breakEnd.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'ongoing'}
                                      </span>
                                      {breakDuration > 0 && (
                                        <span className="ml-1 text-orange-600 font-medium">({breakDuration}m)</span>
                                      )}
                                    </div>
                                  );
                                })}
                                {entry.breaks.length > 3 && (
                                  <div className="text-xs text-gray-500">
                                    +{entry.breaks.length - 3} more breaks
                                  </div>
                                )}
                                <div className="text-xs font-medium text-orange-600 mt-1">
                                  Total: {formatHoursMinutes(entry.totalBreakHours || 0)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">No breaks</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="text-blue-600 font-semibold">{formatHoursMinutes(scheduledHours)}</div>
                            {entry.daySchedule && (
                              <div className="text-xs text-gray-500">
                                {entry.daySchedule.startTime} - {entry.daySchedule.endTime}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="font-semibold text-gray-900">{formatHoursMinutes(displayHours)}</div>
                            {entry.withinSchedule && (
                              <div className="text-xs text-green-600">
                                ✓ Within schedule
                              </div>
                            )}
                            {!entry.withinSchedule && displayHours === 0 && (
                              <div className="text-xs text-red-500">
                                Outside schedule hours
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {entry.holidayInfo ? (
                              <div className="flex flex-col space-y-1">
                                <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                                  entry.holidayInfo.type === 'working_holiday' 
                                    ? 'bg-orange-100 text-orange-800' 
                                    : entry.holidayInfo.type === 'paid_holiday'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {entry.holidayInfo.name}
                                </span>
                                {entry.holidayInfo.payMultiplier && (
                                  <span className="text-xs text-gray-500">
                                    {entry.holidayInfo.payMultiplier}x pay
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">Regular day</span>
                            )}
                          </td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                             <div>£{amount.toFixed(2)}</div>
                             <div className="text-xs text-gray-500">
                               £{payRate.toFixed(2)}/hr × {formatHoursMinutes(displayHours)}
                               {displayHours > 0 && displayHours < 0.1 && (
                                 <div className="text-xs text-blue-600">
                                   (£{(payRate / 60).toFixed(4)}/min × {Math.round(displayHours * 60)}min)
                                 </div>
                               )}
                             </div>
                           </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setShowEmployeeDetails(false);
                    setSelectedEmployee(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// Create User Modal Component
const CreateUserModal = ({ onClose, onUserCreated }: { onClose: () => void, onUserCreated: () => void }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    role: 'staff' as 'staff' | 'pharmacist' | 'c-level',
    position: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const userData: UserData = {
        ...formData,
      };

      const { data, error } = await authService.createUser(userData);

      if (error) {
        setError(error.message);
      } else if (data.user) {
        // The trigger should automatically insert into public.users table
        // But let's add a small delay to ensure it's processed
        setTimeout(() => {
          onUserCreated();
          onClose();
        }, 1000);
      }
    } catch (err) {
      setError('Failed to create user. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Create New User</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter a secure password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="staff">Staff</option>
                <option value="pharmacist">Pharmacist</option>
                <option value="c-level">C-Level</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position (Optional)</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="e.g. Senior Pharmacist, Manager..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`${
                  isLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                } text-white font-medium py-2 px-6 rounded-lg text-sm transition-all duration-200 shadow-lg hover:shadow-xl`}
              >
                {isLoading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Edit User Modal Component
const EditUserModal = ({ user, onClose, onUserUpdated }: { user: any, onClose: () => void, onUserUpdated: (updatedUserData: any) => void }) => {
  const [formData, setFormData] = useState({
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone,
    username: user.username,
    role: user.role,
    position: user.position,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const updatedUserData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        username: formData.username,
        role: formData.role,
        position: formData.position,
      };

      const { error } = await userService.updateUser(user.id, updatedUserData);

      if (error) {
        setError(error.message);
      } else {
        onUserUpdated(updatedUserData);
        onClose();
      }
    } catch (err) {
      setError('Failed to update user. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="staff">Staff</option>
                <option value="pharmacist">Pharmacist</option>
                <option value="c-level">C-Level</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position (Optional)</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="e.g. Senior Pharmacist, Manager..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`${
                  isLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                } text-white font-medium py-2 px-6 rounded-lg text-sm transition-all duration-200 shadow-lg hover:shadow-xl`}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Create Folder Modal Component
const CreateFolderModal = ({ onClose, onFolderCreated }: { onClose: () => void, onFolderCreated: () => void }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await checklistService.createFolder(formData);
      if (error) {
        setError(error.message);
      } else {
        onFolderCreated();
        onClose();
      }
    } catch (err) {
      setError('Failed to create folder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Create New Folder</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Folder Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g. Daily Operations"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this folder's purpose"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Folder Color</label>
              <div className="grid grid-cols-5 gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      formData.color === color 
                        ? 'border-gray-800 scale-110' 
                        : 'border-gray-300 hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`${
                  isLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white font-medium py-2 px-6 rounded-lg text-sm transition-colors`}
              >
                {isLoading ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Create Checklist Modal Component
const CreateChecklistModal = ({ 
  selectedFolder, 
  onClose, 
  onChecklistCreated 
}: { 
  selectedFolder: any, 
  onClose: () => void, 
  onChecklistCreated: () => void 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_users: [] as string[],
    is_daily: true,
    reset_time: '00:00',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await userService.getAllUsers();
      if (error) {
        console.error('Failed to load users:', error);
      } else {
        setAvailableUsers(data || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleUserToggle = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      target_users: prev.target_users.includes(userId)
        ? prev.target_users.filter(id => id !== userId)
        : [...prev.target_users, userId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!selectedFolder) {
      setError('Please select a folder first');
      setIsLoading(false);
      return;
    }

    if (formData.target_users.length === 0) {
      setError('Please select at least one user');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await checklistService.createChecklist({
        folder_id: selectedFolder.id,
        ...formData,
      });
      if (error) {
        setError(error.message);
      } else {
        onChecklistCreated();
        onClose();
      }
    } catch (err) {
      setError('Failed to create checklist. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Create New Checklist</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {selectedFolder && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Folder:</strong> {selectedFolder.name}
              </p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g. Opening Procedures"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this checklist"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to Users *
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                {availableUsers.length === 0 ? (
                  <p className="text-sm text-gray-500">Loading users...</p>
                ) : (
                  availableUsers.map((user) => (
                    <label key={user.id} className="flex items-center">
                    <input
                      type="checkbox"
                        checked={formData.target_users.includes(user.id)}
                        onChange={() => handleUserToggle(user.id)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <div className="ml-3 flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-xs">
                            {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-2">
                          <span className="text-sm text-gray-700">{user.first_name} {user.last_name}</span>
                          <span className="ml-2 text-xs text-gray-500">({user.role})</span>
                        </div>
                      </div>
                  </label>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_daily}
                    onChange={(e) => setFormData({ ...formData, is_daily: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Daily Reset</span>
                </label>
              </div>
              
              {formData.is_daily && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reset Time</label>
                  <input
                    type="time"
                    value={formData.reset_time}
                    onChange={(e) => setFormData({ ...formData, reset_time: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`${
                  isLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700'
                } text-white font-medium py-2 px-6 rounded-lg text-sm transition-colors`}
              >
                {isLoading ? 'Creating...' : 'Create Checklist'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Manage Items Modal Component with Drag & Drop
const ManageItemsModal = ({ 
  checklist, 
  items,
  onClose, 
  onItemsUpdated 
}: { 
  checklist: any, 
  items: any[],
  onClose: () => void, 
  onItemsUpdated: () => void 
}) => {
  const [checklistItems, setChecklistItems] = useState(items);
  const [newItem, setNewItem] = useState({ title: '', description: '', is_required: true });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChecklistItems(items.sort((a, b) => a.sort_order - b.sort_order));
  }, [items]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await checklistService.createChecklistItem({
        checklist_id: checklist.id,
        ...newItem,
        sort_order: checklistItems.length,
      });
      if (error) {
        setError(error.message);
      } else {
        setNewItem({ title: '', description: '', is_required: true });
        onItemsUpdated();
      }
    } catch (err) {
      setError('Failed to add item. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await checklistService.deleteChecklistItem(itemId);
      if (error) {
        alert('Error deleting item: ' + error.message);
      } else {
        onItemsUpdated();
      }
    } catch (error) {
      alert('Error deleting item');
    }
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    const updatedItems = [...checklistItems];
    const [movedItem] = updatedItems.splice(fromIndex, 1);
    updatedItems.splice(toIndex, 0, movedItem);
    
    // Update sort orders
    const itemsWithNewOrder = updatedItems.map((item, index) => ({
      ...item,
      sort_order: index
    }));
    
    setChecklistItems(itemsWithNewOrder);
    
    // Save to database
    checklistService.reorderChecklistItems(
      itemsWithNewOrder.map(item => ({ id: item.id, sort_order: item.sort_order }))
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Manage Tasks</h3>
              <p className="text-sm text-gray-500">{checklist.name}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {/* Add New Item Form */}
          <form onSubmit={handleAddItem} className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Add New Task</h4>
            <div className="space-y-3">
              <input
                type="text"
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                placeholder="Task title"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Task description (optional)"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <div className="flex justify-between items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newItem.is_required}
                    onChange={(e) => setNewItem({ ...newItem, is_required: e.target.checked })}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Required Task</span>
                </label>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {isLoading ? 'Adding...' : 'Add Task'}
                </button>
              </div>
            </div>
          </form>

          {/* Existing Items */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 mb-3">
              Current Tasks ({checklistItems.length})
              <span className="text-sm text-gray-500 ml-2">Drag to reorder</span>
            </h4>
            
            {checklistItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No tasks yet. Add your first task above.
              </div>
            ) : (
              <div className="space-y-2">
                {checklistItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white border border-gray-200 rounded-lg cursor-move hover:bg-gray-50 transition-colors"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', index.toString());
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                      moveItem(fromIndex, index);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        <span className="text-sm font-medium text-gray-500 w-8">
                          {index + 1}.
                        </span>
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{item.title}</h5>
                          {item.description && (
                            <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                          )}
                        </div>
                        {item.is_required && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                            Required
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Edit Folder Modal Component
const EditFolderModal = ({ folder, onClose, onFolderUpdated }: { folder: any, onClose: () => void, onFolderUpdated: () => void }) => {
  const [formData, setFormData] = useState({
    name: folder.name || '',
    description: folder.description || '',
    color: folder.color || '#3B82F6',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await checklistService.updateFolder(folder.id, formData);
      if (error) {
        setError(error.message);
      } else {
        onFolderUpdated();
        onClose();
      }
    } catch (err) {
      setError('Failed to update folder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Edit Folder</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Folder Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter folder name"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter folder description"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className={`w-8 h-8 rounded-lg border-2 ${
                      formData.color === color ? 'border-gray-800' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !formData.name.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Updating...' : 'Update Folder'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Edit Checklist Modal Component
const EditChecklistModal = ({ 
  checklist, 
  onClose, 
  onChecklistUpdated 
}: { 
  checklist: any, 
  onClose: () => void, 
  onChecklistUpdated: () => void 
}) => {
  const [formData, setFormData] = useState({
    name: checklist.name || '',
    description: checklist.description || '',
    target_users: checklist.target_users || [],
    is_daily: checklist.is_daily || true,
    reset_time: checklist.reset_time || '00:00',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await userService.getAllUsers();
      if (error) {
        console.error('Failed to load users:', error);
      } else {
        setAvailableUsers(data || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleUserToggle = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      target_users: prev.target_users.includes(userId)
        ? prev.target_users.filter(id => id !== userId)
        : [...prev.target_users, userId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (formData.target_users.length === 0) {
      setError('Please select at least one user');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await checklistService.updateChecklist(checklist.id, formData);
      if (error) {
        setError(error.message);
      } else {
        onChecklistUpdated();
        onClose();
      }
    } catch (err) {
      setError('Failed to update checklist. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Edit Checklist</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Checklist Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                placeholder="Enter checklist name"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                placeholder="Enter checklist description"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to Users *
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                {availableUsers.length === 0 ? (
                  <p className="text-sm text-gray-500">Loading users...</p>
                ) : (
                  availableUsers.map((user) => (
                    <label key={user.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.target_users.includes(user.id)}
                        onChange={() => handleUserToggle(user.id)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <div className="ml-3 flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-xs">
                            {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-2">
                          <span className="text-sm text-gray-700">{user.first_name} {user.last_name}</span>
                          <span className="ml-2 text-xs text-gray-500">({user.role})</span>
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_daily}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_daily: e.target.checked }))}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Daily Reset</span>
                </label>
              </div>
              
              {formData.is_daily && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reset Time
                  </label>
                  <input
                    type="time"
                    value={formData.reset_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, reset_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              )}
            </div>
            
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !formData.name.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Updating...' : 'Update Checklist'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Create Branch Modal Component
const CreateBranchModal = ({ onClose, onBranchCreated }: { onClose: () => void, onBranchCreated: () => void }) => {
  const [formData, setFormData] = useState({
    branch_name: '',
    branch_code: '',
    address: '',
    city: '',
    state: '',
    postcode: '',
    country: 'Myanmar',
    phone_number: '',
    email: '',
    branch_type: 'main',
    pharmacy_license_number: '',
    notes: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await branchService.createBranch(formData);
      if (error) {
        setError(error.message);
      } else {
        onBranchCreated();
      }
    } catch (err) {
      setError('Failed to create branch. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Create New Branch</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  name="branch_name"
                  value={formData.branch_name}
                  onChange={handleChange}
                  required
                  placeholder="Enter branch name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code *</label>
                <input
                  type="text"
                  name="branch_code"
                  value={formData.branch_code}
                  onChange={handleChange}
                  required
                  placeholder="Enter branch code"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                rows={2}
                placeholder="Enter complete address"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  placeholder="Enter city"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="Enter state/region"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                <input
                  type="text"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleChange}
                  required
                  placeholder="Enter postcode"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter email address"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Type</label>
                <select
                  name="branch_type"
                  value={formData.branch_type}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="main">Main Branch</option>
                  <option value="satellite">Satellite Branch</option>
                  <option value="clinic">Clinic</option>
                  <option value="hospital">Hospital</option>
                  <option value="specialty">Specialty</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy License #</label>
                <input
                  type="text"
                  name="pharmacy_license_number"
                  value={formData.pharmacy_license_number}
                  onChange={handleChange}
                  placeholder="Enter license number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Optional notes about this branch"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`${
                  isLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-orange-600 hover:bg-orange-700'
                } text-white font-medium py-2 px-6 rounded-lg text-sm transition-colors`}
              >
                {isLoading ? 'Creating...' : 'Create Branch'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Edit Branch Modal Component
const EditBranchModal = ({ branch, onClose, onBranchUpdated }: { branch: any, onClose: () => void, onBranchUpdated: () => void }) => {
  const [formData, setFormData] = useState({
    branch_name: branch.branch_name || '',
    branch_code: branch.branch_code || '',
    address: branch.address || '',
    city: branch.city || '',
    state: branch.state || '',
    postcode: branch.postcode || '',
    phone_number: branch.phone_number || '',
    email: branch.email || '',
    branch_type: branch.branch_type || 'main',
    pharmacy_license_number: branch.pharmacy_license_number || '',
    notes: branch.notes || ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await branchService.updateBranch(branch.id, formData);
      if (error) {
        setError(error.message);
      } else {
        onBranchUpdated();
      }
    } catch (err) {
      setError('Failed to update branch. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Edit Branch</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  name="branch_name"
                  value={formData.branch_name}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code *</label>
                <input
                  type="text"
                  name="branch_code"
                  value={formData.branch_code}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                <input
                  type="text"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Type</label>
                <select
                  name="branch_type"
                  value={formData.branch_type}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="main">Main Branch</option>
                  <option value="satellite">Satellite Branch</option>
                  <option value="clinic">Clinic</option>
                  <option value="hospital">Hospital</option>
                  <option value="specialty">Specialty</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy License #</label>
                <input
                  type="text"
                  name="pharmacy_license_number"
                  value={formData.pharmacy_license_number}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`${
                  isLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-orange-600 hover:bg-orange-700'
                } text-white font-medium py-2 px-6 rounded-lg text-sm transition-colors`}
              >
                {isLoading ? 'Updating...' : 'Update Branch'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};



// Branch Details Modal Component
const BranchDetailsModal = ({ branch, staff, loadingStaff, onClose, onAssignStaff }: { 
  branch: any, 
  staff: any[], 
  loadingStaff: boolean, 
  onClose: () => void, 
  onAssignStaff: () => void 
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-8 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-bold mb-2">{branch.branch_name}</h3>
              <p className="text-orange-100 text-sm">
                {branch.branch_code} • {branch.city}
              </p>
              <div className="flex items-center mt-3 space-x-4">
                <span className="bg-white bg-opacity-20 text-white px-3 py-1 rounded-full text-xs font-medium">
                  {branch.branch_type}
                </span>
                <span className="text-orange-100 text-sm">
                  <span className="font-semibold text-white">{staff.length}</span> staff members
                </span>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="text-white hover:text-orange-100 p-2 rounded-full hover:bg-white hover:bg-opacity-10 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 overflow-y-auto max-h-[calc(85vh-140px)]">
          
          {/* Staff Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-xl font-bold text-gray-900">Team Members</h4>
              <button
                onClick={() => {
                  onClose();
                  onAssignStaff();
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Add Staff
              </button>
            </div>

            {loadingStaff ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading team members...</p>
              </div>
            ) : staff.length === 0 ? (
              <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl">
                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h5 className="text-xl font-bold text-gray-900 mb-2">No Team Members Yet</h5>
                <p className="text-gray-500 mb-6">This branch doesn't have any staff assigned</p>
                <button
                  onClick={() => {
                    onClose();
                    onAssignStaff();
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Assign First Team Member
                </button>
              </div>
            ) : (
              <>
                {/* Staff Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {staff.map((assignment) => (
                    <div key={assignment.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:border-orange-200">
                      <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-lg">
                            {assignment.user?.first_name?.charAt(0)}{assignment.user?.last_name?.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h5 className="font-bold text-gray-900 text-lg">
                            {assignment.user?.first_name} {assignment.user?.last_name}
                          </h5>
                          <p className="text-sm text-gray-500 mb-2">{assignment.user?.email}</p>
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                              {assignment.user?.role}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(assignment.assignment_date).toLocaleDateString()}
                            </span>
                          </div>
                          {assignment.position && (
                            <p className="text-xs text-gray-500 mt-2 font-medium">{assignment.position}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Role Summary */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                  <h5 className="text-lg font-bold text-blue-900 mb-4">Team Overview</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(
                      staff.reduce((acc, assignment) => {
                        const role = assignment.user?.role || 'Unknown';
                        acc[role] = (acc[role] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([role, count]) => (
                      <div key={role} className="text-center bg-white rounded-lg p-4 shadow-sm">
                        <div className="text-2xl font-bold text-blue-900">{count}</div>
                        <div className="text-sm text-blue-700 capitalize font-medium">{role}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2.5 px-6 rounded-xl text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Employee Progress Card Component with Task Details
const EmployeeProgressCard = ({ userData, completedCount, totalCount, avgCompletion, folders }: any) => {
  const [expandedChecklist, setExpandedChecklist] = useState<string | null>(null);
  
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
      {/* Employee Header */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">
                {userData.user?.first_name?.charAt(0)}{userData.user?.last_name?.charAt(0)}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {userData.user?.first_name} {userData.user?.last_name}
              </h3>
              <p className="text-sm text-gray-500 flex items-center mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {userData.user?.role}
                </span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {Math.round(avgCompletion)}%
            </div>
            <div className="text-sm text-gray-500">
              {completedCount}/{totalCount} checklists completed
            </div>
            <div className="mt-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${avgCompletion}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Checklists */}
      <div className="p-6 space-y-4">
        {userData.checklists
          .sort((a, b) => b.completion_percentage - a.completion_percentage)
          .map((progress) => (
            <div key={progress.checklist_id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Checklist Header */}
              <div 
                className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setExpandedChecklist(
                  expandedChecklist === progress.checklist_id ? null : progress.checklist_id
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm ${
                      progress.is_fully_completed 
                        ? 'bg-green-100 border-2 border-green-200' 
                        : progress.completed_items > 0 
                        ? 'bg-blue-100 border-2 border-blue-200' 
                        : 'bg-gray-100 border-2 border-gray-200'
                    }`}>
                      {progress.is_fully_completed ? (
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : progress.completed_items > 0 ? (
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-lg">{progress.checklist?.name}</h4>
                      <p className="text-sm text-gray-500">
                        {folders.find(f => f.id === progress.checklist?.folder_id)?.name || 'No folder'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                        progress.is_fully_completed
                          ? 'bg-green-100 text-green-800'
                          : progress.completed_items > 0
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {progress.is_fully_completed ? 'Completed' : progress.completed_items > 0 ? 'In Progress' : 'Not Started'}
                      </span>
                      <div className="text-lg font-bold text-gray-900 mt-1">
                        {Math.round(progress.completion_percentage)}%
                      </div>
                    </div>
                    <svg 
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                        expandedChecklist === progress.checklist_id ? 'rotate-180' : ''
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">
                      {progress.completed_items} of {progress.total_items} tasks completed
                    </span>
                    {progress.completed_at && (
                      <span className="text-xs text-gray-500">
                        Completed at {new Date(progress.completed_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-500 ${
                        progress.is_fully_completed 
                          ? 'bg-gradient-to-r from-green-500 to-green-600' 
                          : progress.completed_items > 0 
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                          : 'bg-gray-300'
                      }`}
                      style={{ width: `${progress.completion_percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Expanded Task Details */}
              {expandedChecklist === progress.checklist_id && (
                <div className="border-t border-gray-200 bg-white">
                  <div className="p-4">
                    <h5 className="font-medium text-gray-900 mb-3">Individual Tasks</h5>
                    {progress.tasks && progress.tasks.length > 0 ? (
                      <div className="space-y-3">
                        {progress.tasks.map((task, index) => {
                          const item = (task as any)?.checklist_items || task;
                          const title = item?.title || '';
                          const description = item?.description || '';
                          const isCompleted = !!task.completed;
                          return (
                          <div key={task.id} className={`flex items-start space-x-3 p-3 rounded-lg ${isCompleted ? 'bg-gray-50' : 'bg-yellow-50'}`}>
                            <div className="flex-shrink-0 mt-0.5">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                isCompleted 
                                  ? 'bg-green-100 border-2 border-green-300' 
                                  : 'bg-gray-100 border-2 border-gray-300'
                              }`}>
                                {isCompleted ? (
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <span className="text-gray-400 text-xs font-bold">{index + 1}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h6 className={`font-medium ${isCompleted ? 'text-green-800 line-through' : 'text-gray-900'}`}>
                                {title || 'Untitled task'}
                              </h6>
                              {description && (
                                <p className={`text-sm mt-1 ${isCompleted ? 'text-green-600' : 'text-gray-600'}`}>
                                  {description}
                                </p>
                              )}
                              {isCompleted && task.completed_at && (
                                <p className="text-xs text-green-600 mt-2">
                                  ✓ Completed at {new Date(task.completed_at).toLocaleTimeString()}
                                </p>
                              )}
                            </div>
                            {task.is_required && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isCompleted ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800' }">
                                {isCompleted ? 'Required' : 'Remaining'}
                              </span>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No tasks defined for this checklist.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
};

// Live Time Tracking Card Component
const LiveTimeTrackingCard = () => {
  const [liveEntries, setLiveEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLiveEntries();
    const interval = setInterval(loadLiveEntries, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadLiveEntries = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await timeTrackingService.getAllTimeEntries(today, today);
      
      if (error) {
        console.error('Error loading live entries:', error);
      } else {
        // Filter for currently clocked in users
        const activeEntries = data?.filter(entry => entry.status === 'clocked_in') || [];
        setLiveEntries(activeEntries);
      }
    } catch (error) {
      console.error('Error loading live entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatWorkingTime = (clockInTime: string) => {
    const clockIn = new Date(clockInTime);
    const now = new Date();
    const diffMs = now.getTime() - clockIn.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Currently Clocked In</h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-600 font-medium">Live</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse flex space-x-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : liveEntries.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">No employees currently clocked in</p>
        </div>
      ) : (
        <div className="space-y-3">
          {liveEntries.map((entry) => (
            <div key={entry.id} className="flex items-center space-x-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-green-700">
                  {entry.user?.first_name?.[0]}{entry.user?.last_name?.[0]}
                </span>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">
                    {entry.user?.first_name} {entry.user?.last_name}
                  </p>
                  <span className="text-sm font-medium text-green-600">
                    {formatWorkingTime(entry.clock_in_time)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-gray-500">
                    <span>Started: {new Date(entry.clock_in_time).toLocaleTimeString('en-US', {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {entry.branch?.branch_name}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Employee Schedules Card Component
const EmployeeSchedulesCard = ({ users, branches }: { users: any[], branches: any[] }) => {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userSchedule, setUserSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const loadUserSchedule = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await timeTrackingService.getEmployeeSchedule(userId);
      if (error) {
        console.error('Error loading schedule:', error);
      } else {
        setUserSchedule(data);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user: any) => {
    setSelectedUser(user);
    loadUserSchedule(user.id);
    setShowModal(true);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Employee Schedules</h3>
        
        {users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No employees found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.filter(user => user.role !== 'administrator').map((user) => (
              <div
                key={user.id}
                onClick={() => handleUserSelect(user)}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-blue-700">
                      {user.first_name?.[0]}{user.last_name?.[0]}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showModal && selectedUser && (
        <ScheduleModal
          user={selectedUser}
          schedule={userSchedule}
          branches={branches}
          loading={loading}
          onClose={() => {
            setShowModal(false);
            setSelectedUser(null);
            setUserSchedule(null);
          }}
          onSave={() => loadUserSchedule(selectedUser.id)}
        />
      )}
    </>
  );
};

// Branch Locations Card Component
const BranchLocationsCard = ({ branches }: { branches: any[] }) => {
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [branchLocation, setBranchLocation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const loadBranchLocation = async (branchId: string) => {
    setLoading(true);
    try {
      const { data, error } = await timeTrackingService.getBranchLocation(branchId);
      if (error) {
        console.error('Error loading branch location:', error);
      } else {
        setBranchLocation(data);
      }
    } catch (error) {
      console.error('Error loading branch location:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBranchSelect = (branch: any) => {
    setSelectedBranch(branch);
    loadBranchLocation(branch.id);
    setShowModal(true);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Branch Locations</h3>
        
        {branches.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No branches found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((branch) => (
              <div
                key={branch.id}
                onClick={() => handleBranchSelect(branch)}
                className="p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{branch.branch_name}</p>
                    <p className="text-xs text-gray-500">{branch.city}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{branch.branch_code}</p>
                    <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Location Modal */}
      {showModal && selectedBranch && (
        <BranchLocationPicker
          branch={selectedBranch}
          location={branchLocation}
          onClose={() => {
            setShowModal(false);
            setSelectedBranch(null);
            setBranchLocation(null);
          }}
          onSave={loadBranchLocation}
        />
      )}
    </>
  );
};

// Schedule Modal Component
const ScheduleModal = ({ user, schedule, branches, loading, onClose, onSave }: any) => {
  const [formData, setFormData] = useState({
    monday_start: '',
    monday_end: '',
    tuesday_start: '',
    tuesday_end: '',
    wednesday_start: '',
    wednesday_end: '',
    thursday_start: '',
    thursday_end: '',
    friday_start: '',
    friday_end: '',
    saturday_start: '',
    saturday_end: '',
    sunday_start: '',
    sunday_end: '',
    branch_id: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (schedule) {
      setFormData({
        monday_start: schedule.monday_start || '',
        monday_end: schedule.monday_end || '',
        tuesday_start: schedule.tuesday_start || '',
        tuesday_end: schedule.tuesday_end || '',
        wednesday_start: schedule.wednesday_start || '',
        wednesday_end: schedule.wednesday_end || '',
        thursday_start: schedule.thursday_start || '',
        thursday_end: schedule.thursday_end || '',
        friday_start: schedule.friday_start || '',
        friday_end: schedule.friday_end || '',
        saturday_start: schedule.saturday_start || '',
        saturday_end: schedule.saturday_end || '',
        sunday_start: schedule.sunday_start || '',
        sunday_end: schedule.sunday_end || '',
        branch_id: schedule.branch_id || '',
      });
    }
  }, [schedule]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (schedule?.id) {
        // Update existing schedule
        await timeTrackingService.updateEmployeeSchedule(schedule.id, formData);
      } else {
        // Create new schedule
        await timeTrackingService.createEmployeeSchedule({
          ...formData,
          user_id: user.id,
          is_active: true
        });
      }
      
      alert('Schedule saved successfully');
      onSave(user.id);
      onClose();
    } catch (error: any) {
      alert('Error saving schedule: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const days = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 
    'Friday', 'Saturday', 'Sunday'
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Schedule for {user.first_name} {user.last_name}
          </h3>
        </div>

        {/* Branch Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assigned Branch
          </label>
          <select
            value={formData.branch_id}
            onChange={(e) => setFormData(prev => ({ ...prev, branch_id: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Select a branch...</option>
            {branches?.map((branch: any) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} - {branch.location}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {days.map((day) => {
            const dayKey = day.toLowerCase();
            return (
              <div key={day} className="grid grid-cols-3 gap-4 items-center">
                <div className="font-medium text-sm text-gray-700">{day}</div>
                <div>
                  <input
                    type="time"
                    value={formData[`${dayKey}_start` as keyof typeof formData]}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      [`${dayKey}_start`]: e.target.value 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <input
                    type="time"
                    value={formData[`${dayKey}_end` as keyof typeof formData]}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      [`${dayKey}_end`]: e.target.value 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};



export default AdminDashboard; 