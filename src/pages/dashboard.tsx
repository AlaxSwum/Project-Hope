import { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { authService, userService, supabase } from '../lib/supabase-secure';
import { checklistService, timeTrackingService } from '../lib/supabase-secure';
import { passwordManagerService, PasswordEntry } from '../lib/password-manager-service';
import { PasswordDetailsModal } from '../components/PasswordDetailsModal';
import ImprovedClockInOut from '../components/ImprovedClockInOut';

const Dashboard: NextPage = () => {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [userBranchId, setUserBranchId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Time tracking state
  const [totalHoursToday, setTotalHoursToday] = useState<number>(0);
  const [totalHoursWeek, setTotalHoursWeek] = useState<number>(0);
  const [totalHoursMonth, setTotalHoursMonth] = useState<number>(0);
  
  // Checklist state
  const [userChecklists, setUserChecklists] = useState<any[]>([]);
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [dailyStatus, setDailyStatus] = useState<any[]>([]);

  // Password Manager state
  const [userPasswords, setUserPasswords] = useState<PasswordEntry[]>([]);
  const [selectedPassword, setSelectedPassword] = useState<PasswordEntry | null>(null);
  const [showPasswordDetails, setShowPasswordDetails] = useState(false);
  const [loadingPasswords, setLoadingPasswords] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUser && activeSection === 'checklists') {
      loadUserChecklists();
      loadUserProgress();
      loadDailyStatus();
    }
    if (currentUser && activeSection === 'timetracking') {
      loadTotalHours();
    }
    if (currentUser && activeSection === 'passwords') {
      loadUserAccessiblePasswords();
    }
  }, [currentUser, activeSection]);

  const checkAuth = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      
      setCurrentUser(user);
      
      // Try to get the user profile from database
      try {
        const userWithProfile = await authService.getCurrentUserWithProfile();
        setUserProfile(userWithProfile?.profile);
        
        // Get user's branch assignment from branch_staff_assignments
        try {
          // Check branch_staff_assignments table for branch assignment
                      const { data: branchAssignment } = await supabase
              .from('branch_staff_assignments')
              .select('branch_id')
              .eq('user_id', user.id)
              .single();
          
          if (branchAssignment?.branch_id) {
            setUserBranchId(branchAssignment.branch_id);
          }
        } catch (branchError) {
          console.log('No branch assignment found:', branchError);
          // Fallback: try to get any active branch for the user
          try {
                         const { data: fallbackBranch } = await supabase
               .from('pharmacy_branches')
               .select('id')
               .eq('is_active', true)
               .limit(1)
               .single();
            
            if (fallbackBranch?.id) {
              setUserBranchId(fallbackBranch.id);
            }
          } catch (fallbackError) {
            console.log('No fallback branch found:', fallbackError);
          }
        }
      } catch (error) {
        console.log('Profile data not available yet:', error);
      }
      
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    router.push('/login');
  };

  // Checklist functions
  const loadUserChecklists = async () => {
    if (!currentUser) return;
    
    try {
      const { data, error } = await checklistService.getChecklistsForUser(currentUser.id, userProfile?.role);
      if (error) {
        console.error('Failed to load checklists:', error);
      } else {
        setUserChecklists(data || []);
      }
    } catch (error) {
      console.error('Error loading checklists:', error);
    }
  };

  const loadUserProgress = async () => {
    if (!currentUser) return;
    
    try {
      const { data, error } = await checklistService.getUserProgress(currentUser.id);
      if (error) {
        console.error('Failed to load progress:', error);
      } else {
        setUserProgress(data || []);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const loadDailyStatus = async () => {
    if (!currentUser) return;
    
    try {
      const { data, error } = await checklistService.getDailyStatus(currentUser.id);
      if (error) {
        console.error('Failed to load daily status:', error);
      } else {
        setDailyStatus(data || []);
      }
    } catch (error) {
      console.error('Error loading daily status:', error);
    }
  };

  const loadTotalHours = async () => {
    if (!currentUser) return;
    
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      // Calculate start of week (Monday)
      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      const weekStr = startOfWeek.toISOString().split('T')[0];
      
      // Calculate start of month
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStr = startOfMonth.toISOString().split('T')[0];
      
      // Get time entries for different periods
      const [todayEntries, weekEntries, monthEntries] = await Promise.all([
        timeTrackingService.getTimeEntries(currentUser.id, todayStr, todayStr),
        timeTrackingService.getTimeEntries(currentUser.id, weekStr, todayStr),
        timeTrackingService.getTimeEntries(currentUser.id, monthStr, todayStr)
      ]);
      
      // Calculate total hours for each period
      const calculateHours = (entries: any[]) => {
        return entries.reduce((total, entry) => {
          if (entry.clock_out_time) {
            const clockIn = new Date(entry.clock_in_time);
            const clockOut = new Date(entry.clock_out_time);
            const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
            return total + hours;
          }
          return total;
        }, 0);
      };
      
      setTotalHoursToday(Math.round(calculateHours(todayEntries.data || []) * 100) / 100);
      setTotalHoursWeek(Math.round(calculateHours(weekEntries.data || []) * 100) / 100);
      setTotalHoursMonth(Math.round(calculateHours(monthEntries.data || []) * 100) / 100);
      
    } catch (error) {
      console.error('Error loading total hours:', error);
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

  const handleItemToggle = async (checklistId: string, itemId: string, completed: boolean) => {
    if (!currentUser) return;
    
    try {
      const { error } = await checklistService.updateItemProgress({
        user_id: currentUser.id,
        checklist_id: checklistId,
        checklist_item_id: itemId,
        completed: completed
      });
      
      if (error) {
        console.error('Failed to update progress:', error);
        alert('Failed to update progress');
      } else {
        // Reload progress and daily status
        loadUserProgress();
        loadDailyStatus();
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      alert('Error updating progress');
    }
  };

  const loadUserAccessiblePasswords = async () => {
    setLoadingPasswords(true);
    try {
      const { data, error } = await passwordManagerService.getUserAccessiblePasswords();
      if (error) {
        console.error('Failed to load user passwords:', error);
      } else {
        setUserPasswords(data || []);
      }
    } catch (error) {
      console.error('Error loading user passwords:', error);
    } finally {
      setLoadingPasswords(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Get user data from multiple sources
  const userRole = userProfile?.role || currentUser?.user_metadata?.role || 'staff';
  const isAdmin = userRole === 'administrator';
  const firstName = userProfile?.first_name || currentUser?.user_metadata?.first_name || 'User';
  const lastName = userProfile?.last_name || currentUser?.user_metadata?.last_name || '';
  const fullName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : currentUser?.user_metadata?.full_name || `${firstName} ${lastName}`;
  const username = userProfile?.username || currentUser?.user_metadata?.username || '';
  const phone = userProfile?.phone || currentUser?.user_metadata?.phone || '';
  const position = userProfile?.position || currentUser?.user_metadata?.position || '';
  const userId = currentUser?.id || '';

  const navigation = [
    { 
      name: 'Dashboard', 
      id: 'dashboard', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6a2 2 0 01-2 2H10a2 2 0 01-2-2V5z" />
        </svg>
      ), 
      current: activeSection === 'dashboard' 
    },
    { 
      name: 'Time Tracking', 
      id: 'timetracking', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ), 
      current: activeSection === 'timetracking' 
    },
    { 
      name: 'Inventory', 
      id: 'inventory', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ), 
      current: activeSection === 'inventory' 
    },
    { 
      name: 'Prescriptions', 
      id: 'prescriptions', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ), 
      current: activeSection === 'prescriptions' 
    },
    { 
      name: 'Checklists', 
      id: 'checklists', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ), 
      current: activeSection === 'checklists',
      count: userChecklists.length
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
      name: 'Reports', 
      id: 'reports', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ), 
      current: activeSection === 'reports' 
    },
    { 
      name: 'Settings', 
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

  return (
    <>
      <Head>
        <title>Dashboard - Hope Pharmacy IMS</title>
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
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-lg">H</span>
                    </div>
                    <div className="ml-3">
                      <h1 className="text-lg font-bold text-gray-900">Hope Pharmacy</h1>
                      <p className="text-xs text-gray-500">Inventory Management</p>
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
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">{firstName.charAt(0)}{lastName.charAt(0) || firstName.charAt(1)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{fullName}</p>
                      <p className="text-xs text-gray-500 truncate">{userRole} • {userProfile?.position || 'Staff'}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="mt-3">
                      <a
                        href="/admin/dashboard"
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        → Admin Dashboard
                      </a>
                    </div>
                  )}
                </div>

                {/* Mobile Navigation */}
                <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
                  {navigation.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveSection(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`${
                        item.current
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } group flex items-center px-3 py-2 text-sm font-medium border-l-4 rounded-r-lg transition-all duration-200 w-full`}
                    >
                      <span className={`${item.current ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'} mr-3`}>
                        {item.icon}
                      </span>
                      <span className="flex-1 text-left">{item.name}</span>
                      {item.count && item.count > 0 && (
                        <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {item.count}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>

                {/* Mobile Sign Out */}
                <div className="px-6 py-4 border-t border-gray-100">
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
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">H</span>
              </div>
              <div className="ml-3">
                <h1 className="text-lg font-bold text-gray-900">Hope Pharmacy</h1>
                <p className="text-xs text-gray-500">Inventory Management</p>
              </div>
            </div>

            {/* User Info Card */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">{firstName.charAt(0)}{lastName.charAt(0) || firstName.charAt(1)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{firstName}</p>
                  <p className="text-xs text-gray-500 truncate">{position || userRole}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  userRole === 'pharmacist'
                    ? 'bg-green-100 text-green-700'
                    : userRole === 'c-level'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {userRole === 'administrator' ? 'Manager' : userRole}
                </span>
              </div>
            </div>

            {/* Create New Button */}
            <div className="px-6 py-4">
              <button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl px-4 py-3 text-sm font-semibold flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New Order
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
                      ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border-r-2 border-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  } group flex items-center justify-between px-3 py-3 text-sm font-medium w-full text-left transition-all duration-200 rounded-l-xl`}
                >
                  <div className="flex items-center">
                  <span className="mr-3">{item.icon}</span>
                  {item.name}
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none rounded-full ${
                      item.current 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-400 text-white'
                    }`}>
                      {item.count}
                    </span>
                  )}
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
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">H</span>
                  </div>
                  <h1 className="ml-2 text-lg font-bold text-gray-900">Hope Pharmacy</h1>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">{firstName.charAt(0)}{lastName.charAt(0) || firstName.charAt(1)}</span>
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
                      {activeSection}
                    </h2>
                    <p className="text-sm text-gray-500">{formattedDate}</p>
                  </div>
                  
                  {/* Management Dashboard Button */}
                  {isAdmin && (
                    <div className="ml-8">
                      <button
                        onClick={() => router.push('/admin/dashboard')}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>Management Dashboard</span>
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-4">
                  {/* Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search..."
                      className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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

                  {/* Messages */}
                  <button className="p-2 text-gray-400 hover:text-gray-600 relative rounded-lg hover:bg-gray-50 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></span>
                  </button>

                  {/* User Profile Dropdown */}
                  <div className="flex items-center space-x-3 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">{firstName.charAt(0)}{lastName.charAt(0) || firstName.charAt(1)}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">{firstName}</p>
                      <p className="text-xs text-gray-500">{userRole}</p>
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
            <div className="px-6 py-8">
              {/* Dashboard Section */}
              {activeSection === 'dashboard' && (
                <div className="space-y-8">
                  {/* Welcome Section */}
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-white relative overflow-hidden">
                    <div className="relative z-10">
                      <h1 className="text-3xl font-bold mb-2">Hi, {firstName}</h1>
                      <p className="text-indigo-100 text-lg">Ready to start your day with some pharmacy management?</p>
                    </div>
                    <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                      <div className="w-40 h-40 bg-white bg-opacity-10 rounded-full flex items-center justify-center">
                        <svg className="w-20 h-20 text-white opacity-50" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Overview Stats */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Overview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="bg-yellow-400 rounded-xl p-6 text-white">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-yellow-100 text-sm font-medium">Open Rate</p>
                            <p className="text-3xl font-bold">63%</p>
                          </div>
                          <svg className="w-8 h-8 text-yellow-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                      </div>

                      <div className="bg-indigo-600 rounded-xl p-6 text-white">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-indigo-200 text-sm font-medium">Complete</p>
                            <p className="text-3xl font-bold">77%</p>
                          </div>
                          <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>

                      <div className="bg-pink-500 rounded-xl p-6 text-white">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-pink-200 text-sm font-medium">Unique Views</p>
                            <p className="text-3xl font-bold">91</p>
                          </div>
                          <svg className="w-8 h-8 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </div>
                      </div>

                      <div className="bg-purple-400 rounded-xl p-6 text-white">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-purple-200 text-sm font-medium">Total Views</p>
                            <p className="text-3xl font-bold">126</p>
                          </div>
                          <svg className="w-8 h-8 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Projects */}
                  <div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">Inventory Management</h4>
                              <p className="text-sm text-gray-500">Manage your pharmacy stock efficiently</p>
                              <p className="text-xs text-gray-400 mt-1">10 Items</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Public
                            </span>
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">Sales Analytics</h4>
                              <p className="text-sm text-gray-500">Track your pharmacy sales and revenue</p>
                              <p className="text-xs text-gray-400 mt-1">15 Reports</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Private
                            </span>
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Time Tracking Section */}
              {activeSection === 'timetracking' && (
                <div className="space-y-8">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white relative overflow-hidden">
                    <div className="relative z-10">
                      <h1 className="text-3xl font-bold mb-2">Time Tracking</h1>
                      <p className="text-blue-100 text-lg">Clock in and out with location verification</p>
                    </div>
                    <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                      <div className="w-40 h-40 bg-white bg-opacity-10 rounded-full flex items-center justify-center">
                        <svg className="w-20 h-20 text-white opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Total Hours Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500">Today</p>
                          <p className="text-2xl font-bold text-gray-900">{totalHoursToday}h</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 012 0v4h4a1 1 0 010 2h-4v4a1 1 0 01-2 0V9H4a1 1 0 010-2h4z" />
                            </svg>
                          </div>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500">This Week</p>
                          <p className="text-2xl font-bold text-gray-900">{totalHoursWeek}h</p>
                        </div>
                      </div>
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
                          <p className="text-sm font-medium text-gray-500">This Month</p>
                          <p className="text-2xl font-bold text-gray-900">{totalHoursMonth}h</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Clock In/Out Widget */}
                  <div className="max-w-md mx-auto">
                    <ImprovedClockInOut 
                      userId={currentUser?.id} 
                      userBranchId={userBranchId}
                    />
                  </div>


                </div>
              )}

              {/* Other Sections */}
              {activeSection === 'inventory' && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Inventory Management</h3>
                  <p className="text-gray-500">Coming soon - Manage your pharmacy inventory</p>
                </div>
              )}

              {activeSection === 'prescriptions' && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Prescription Management</h3>
                  <p className="text-gray-500">Coming soon - Handle prescriptions and orders</p>
                </div>
              )}

              {/* Checklist Section */}
              {activeSection === 'checklists' && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-white">
                    <div className="flex justify-between items-center">
                      <div>
                        <h1 className="text-3xl font-bold mb-2">My Checklists</h1>
                        <p className="text-green-100 text-lg">Complete your daily tasks</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{userChecklists.length}</div>
                        <div className="text-green-200 text-sm">Assigned Checklists</div>
                      </div>
                    </div>
                  </div>

                  {userChecklists.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No checklists assigned</h3>
                      <p className="text-gray-500">You don't have any checklists assigned to your role yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                      {userChecklists.map((checklist) => {
                        const todayStatus = dailyStatus.find(status => 
                          status.checklist_id === checklist.id && 
                          status.date_for === new Date().toISOString().split('T')[0]
                        );
                        const completionPercentage = todayStatus?.completion_percentage || 0;
                        const isCompleted = todayStatus?.is_fully_completed || false;

                        return (
                          <div
                            key={checklist.id}
                            className={`bg-white rounded-xl p-6 shadow-sm border transition-all duration-200 hover:shadow-md cursor-pointer ${
                              isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-100 hover:border-green-200'
                            }`}
                            onClick={() => {
                              setSelectedChecklist(checklist);
                              loadChecklistItems(checklist.id);
                            }}
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center space-x-3">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                  isCompleted ? 'bg-green-600' : 'bg-gray-100'
                                }`}>
                                  {isCompleted ? (
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                  )}
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900">{checklist.name}</h3>
                                  <p className="text-sm text-gray-500">{checklist.folder?.name}</p>
                                </div>
                              </div>
                              {checklist.is_daily && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                  Daily
                                </span>
                              )}
                            </div>
                            
                            {checklist.description && (
                              <p className="text-sm text-gray-600 mb-4">{checklist.description}</p>
                            )}
                            
                            {/* Progress Bar */}
                            <div className="mb-4">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-700">Progress</span>
                                <span className="text-sm text-gray-500">{Math.round(completionPercentage)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    isCompleted ? 'bg-green-600' : 'bg-blue-600'
                                  }`}
                                  style={{ width: `${completionPercentage}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500">
                                {todayStatus?.completed_items || 0} of {todayStatus?.total_items || 0} tasks
                              </span>
                              <span className="text-green-600 font-medium">
                                {isCompleted ? 'Completed' : 'In Progress'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'reports' && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Reports & Analytics</h3>
                  <p className="text-gray-500">Coming soon - View reports and analytics</p>
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
                        <p className="text-red-100 text-lg">Access your shared passwords securely</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{userPasswords.length}</div>
                        <div className="text-red-200 text-sm">Available Passwords</div>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 bg-red-50">
                      <h3 className="text-xl font-semibold text-gray-900">Shared Passwords</h3>
                      <p className="text-sm text-gray-500 mt-1">Passwords that have been shared with you</p>
                    </div>
                    
                    <div className="p-6">
                      {loadingPasswords ? (
                        <div className="text-center py-16">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                          <p className="mt-4 text-gray-600">Loading passwords...</p>
                        </div>
                      ) : userPasswords.length === 0 ? (
                        <div className="text-center py-16">
                          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">No passwords shared with you</h4>
                          <p className="text-gray-500">When administrators share passwords with you, they will appear here</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Group passwords by folder */}
                          {Object.entries(userPasswords.reduce((acc, password) => {
                            const folderName = password.folder_name || 'No Folder';
                            if (!acc[folderName]) acc[folderName] = [];
                            acc[folderName].push(password);
                            return acc;
                          }, {} as {[key: string]: PasswordEntry[]})).map(([folderName, passwords]) => (
                            <div key={folderName} className="border border-gray-200 rounded-lg">
                              <div className="p-4 bg-gray-50 border-b border-gray-200">
                                <div className="flex items-center space-x-2">
                                  <div 
                                    className="w-4 h-4 rounded"
                                    style={{ backgroundColor: passwords[0]?.folder_color || '#6366f1' }}
                                  ></div>
                                  <h4 className="font-medium text-gray-900">{folderName}</h4>
                                  <span className="text-sm text-gray-500">({passwords.length} passwords)</span>
                                </div>
                              </div>
                              <div className="p-4 space-y-3">
                                {passwords.map((password) => (
                                  <div
                                    key={password.id}
                                    onClick={async () => {
                                      // Load the full entry with enhanced fields
                                      const { data: fullEntry, error } = await passwordManagerService.getPasswordEntryWithEnhancedFields(password.id);
                                      if (error) {
                                        console.error('Error loading password details:', error);
                                        setSelectedPassword(password); // Fallback to basic entry
                                      } else {
                                        setSelectedPassword(fullEntry);
                                      }
                                      setShowPasswordDetails(true);
                                    }}
                                    className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <div className="flex-1">
                                      <h5 className="font-medium text-gray-900">{password.name}</h5>
                                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                        {password.website_name && (
                                          <span>{password.website_name}</span>
                                        )}
                                        {password.email && (
                                          <span>{password.email}</span>
                                        )}
                                        {password.username && (
                                          <span>@{password.username}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                        password.can_edit 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {password.can_edit ? 'Can Edit' : 'View Only'}
                                      </span>
                                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'settings' && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">System Settings</h3>
                  <p className="text-gray-500">Coming soon - Configure system settings</p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Checklist Detail Modal */}
      {selectedChecklist && (
        <ChecklistDetailModal 
          checklist={selectedChecklist}
          items={checklistItems}
          userProgress={userProgress}
          onClose={() => {
            setSelectedChecklist(null);
            setChecklistItems([]);
          }}
          onItemToggle={handleItemToggle}
        />
      )}

      {/* Password Details Modal */}
      <PasswordDetailsModal
        isOpen={showPasswordDetails}
        onClose={() => {
          setShowPasswordDetails(false);
          setSelectedPassword(null);
        }}
        entry={selectedPassword}
        onEdit={() => {
          // Regular users can't edit, but we can show a message or redirect to admin
          alert('Please contact an administrator to edit this password entry.');
        }}
        onShare={() => {
          // Regular users can't share
          alert('Please contact an administrator to manage password sharing.');
        }}
      />
    </>
  );
};



// Checklist Detail Modal Component
const ChecklistDetailModal = ({ 
  checklist, 
  items, 
  userProgress, 
  onClose, 
  onItemToggle 
}: { 
  checklist: any, 
  items: any[], 
  userProgress: any[], 
  onClose: () => void, 
  onItemToggle: (checklistId: string, itemId: string, completed: boolean) => void 
}) => {
  const today = new Date().toISOString().split('T')[0];
  
  const getItemProgress = (itemId: string) => {
    return userProgress.find(p => 
      p.checklist_item_id === itemId && 
      p.date_for === today
    );
  };

  const completedItems = items.filter(item => {
    const progress = getItemProgress(item.id);
    return progress?.completed;
  }).length;

  const totalItems = items.length;
  const completionPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">{checklist.name}</h3>
              <p className="text-green-100 text-sm mb-3">{checklist.description}</p>
              <div className="flex items-center space-x-4 text-sm">
                <span className="bg-white bg-opacity-20 px-2 py-1 rounded">
                  {checklist.folder?.name}
                </span>
                {checklist.is_daily && (
                  <span className="bg-blue-500 px-2 py-1 rounded">
                    Daily Reset
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="text-white hover:text-gray-200 p-1 ml-4"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress Section */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold text-gray-900">Today's Progress</h4>
            <span className="text-lg font-bold text-gray-900">
              {Math.round(completionPercentage)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div 
              className="bg-green-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>{completedItems} of {totalItems} tasks completed</span>
            <span>{new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'short', 
              day: 'numeric' 
            })}</span>
          </div>
        </div>

        {/* Items List */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {items.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <p className="text-gray-500">No tasks in this checklist</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((item, index) => {
                  const progress = getItemProgress(item.id);
                  const isCompleted = progress?.completed || false;
                  
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start space-x-4 p-4 rounded-lg border transition-all duration-200 ${
                        isCompleted 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-white border-gray-200 hover:border-green-300'
                      }`}
                    >
                      <div className="flex items-center pt-1">
                        <span className="text-sm font-medium text-gray-500 w-8">
                          {index + 1}.
                        </span>
                        <button
                          onClick={() => onItemToggle(checklist.id, item.id, !isCompleted)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                            isCompleted
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'border-gray-300 hover:border-green-500'
                          }`}
                        >
                          {isCompleted && (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </div>
                      
                      <div className="flex-1">
                        <h5 className={`font-medium ${
                          isCompleted ? 'text-green-800 line-through' : 'text-gray-900'
                        }`}>
                          {item.title}
                        </h5>
                        {item.description && (
                          <p className={`text-sm mt-1 ${
                            isCompleted ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            {item.description}
                          </p>
                        )}
                        {item.is_required && (
                          <span className="inline-block mt-2 px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                            Required
                          </span>
                        )}
                        {progress?.completed_at && (
                          <p className="text-xs text-green-600 mt-2">
                            Completed at {new Date(progress.completed_at).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {completedItems === totalItems && totalItems > 0 ? (
                <span className="text-green-600 font-medium">🎉 All tasks completed!</span>
              ) : (
                <span>{totalItems - completedItems} tasks remaining</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 