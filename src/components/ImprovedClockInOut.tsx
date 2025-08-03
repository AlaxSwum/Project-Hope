import React, { useState, useEffect } from 'react';
import { timeTrackingService, TimeEntry, BranchLocation } from '../lib/supabase-secure';
import { improvedLocationService, LocationResult, LocationCheckResult } from '../lib/improved-location-service';

interface ImprovedClockInOutProps {
  userId: string;
  userBranchId?: string;
}

interface LocationStatus {
  checking: boolean;
  hasPermission: boolean;
  needsPermission: boolean;
  withinRadius: boolean;
  distance?: number;
  accuracy?: number;
  error?: string;
  lastChecked?: Date;
}

const ImprovedClockInOut: React.FC<ImprovedClockInOutProps> = ({ userId, userBranchId }) => {
  // Basic state
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [branchLocation, setBranchLocation] = useState<BranchLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [workingHours, setWorkingHours] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showNotes, setShowNotes] = useState(false);

  // Location state
  const [locationStatus, setLocationStatus] = useState<LocationStatus>({
    checking: false,
    hasPermission: false,
    needsPermission: true,
    withinRadius: false
  });

  // Permission dialog state
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);

  // Break management state
  const [currentBreak, setCurrentBreak] = useState<any>(null);
  const [breakLoading, setBreakLoading] = useState(false);

  // Update current time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate working hours if clocked in
  useEffect(() => {
    if (currentEntry?.clock_in_time) {
      const updateWorkingHours = () => {
        const clockInTime = new Date(currentEntry.clock_in_time);
        const now = new Date();
        const diffMs = now.getTime() - clockInTime.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        setWorkingHours(`${hours}h ${minutes}m`);
      };

      updateWorkingHours();
      const interval = setInterval(updateWorkingHours, 60000);
      return () => clearInterval(interval);
    } else {
      setWorkingHours('');
    }
  }, [currentEntry]);

  // Load initial data
  useEffect(() => {
    loadCurrentEntry();
    if (userBranchId) {
      loadBranchLocation();
    }
    checkInitialPermissionStatus();
  }, [userId, userBranchId]);

  // Load current break when entry changes
  useEffect(() => {
    if (currentEntry) {
      loadCurrentBreak();
    }
  }, [currentEntry]);

  const loadCurrentEntry = async () => {
    try {
      console.log('🔄 Loading current entry for user:', userId);
      const { data, error } = await timeTrackingService.getCurrentTimeEntry(userId);
      if (error) {
        console.error('❌ Error loading current entry:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      } else {
        console.log('✅ Current entry loaded:', data);
        setCurrentEntry(data);
      }
    } catch (error) {
      console.error('❌ Exception loading current entry:', error);
    }
  };

  const loadBranchLocation = async () => {
    if (!userBranchId) return;
    
    try {
      const { data, error } = await timeTrackingService.getBranchLocation(userBranchId);
      if (error) {
        console.error('Error loading branch location:', error);
      } else {
        setBranchLocation(data);
      }
    } catch (error) {
      console.error('Error loading branch location:', error);
    }
  };

  const loadCurrentBreak = async () => {
    if (!currentEntry) return;
    
    try {
      const { data, error } = await timeTrackingService.getActiveBreak(currentEntry.id);
      if (error) {
        console.error('Error loading current break:', error);
      } else {
        console.log('✅ Break status loaded:', data ? 'On break' : 'Not on break');
        setCurrentBreak(data);
      }
    } catch (error) {
      console.error('Exception loading current break:', error);
    }
  };

  const checkInitialPermissionStatus = async () => {
    if (!improvedLocationService.isSupported()) {
      setLocationStatus({
        checking: false,
        hasPermission: false,
        needsPermission: false,
        withinRadius: false,
        error: 'Location services not supported by your device'
      });
      return;
    }

    const permissionState = await improvedLocationService.checkPermissionStatus();
    setLocationStatus(prev => ({
      ...prev,
      hasPermission: permissionState.granted,
      needsPermission: !permissionState.granted && permissionState.canPrompt,
      error: permissionState.denied ? permissionState.message : undefined
    }));
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    setRequestingPermission(true);
    setShowPermissionDialog(false);

    // Reset previous permission state to force fresh check
    setLocationStatus(prev => ({
      ...prev,
      hasPermission: false,
      needsPermission: true,
      error: undefined,
      withinRadius: false,
      distance: undefined,
      accuracy: undefined
    }));

    try {
      console.log('🔄 Refreshing location permission status...');
      
      // Skip permission check - directly test location access
      // This is more reliable than checking permission state in Chrome
      console.log('🌍 Testing location access directly...');
      const result = await improvedLocationService.requestLocationAccess();
      
      if (result.success) {
        setLocationStatus(prev => ({
          ...prev,
          hasPermission: true,
          needsPermission: false,
          error: undefined
        }));
        
        // Automatically check location after permission is granted
        setTimeout(() => {
          checkUserLocation();
        }, 500);
        
        return true;
      } else {
        setLocationStatus(prev => ({
          ...prev,
          hasPermission: false,
          needsPermission: result.needsPermission || false,
          error: result.error
        }));
        
        // Only show manual instructions if the automatic request failed
        if (result.needsPermission) {
          setShowPermissionDialog(true);
        }
        
        return false;
      }
    } catch (error: any) {
      setLocationStatus(prev => ({
        ...prev,
        error: error.message || 'Failed to request location permission'
      }));
      return false;
    } finally {
      setRequestingPermission(false);
    }
  };

  const checkUserLocation = async () => {
    if (!branchLocation) {
      setLocationStatus(prev => ({
        ...prev,
        checking: false,
        error: 'No workplace location configured for your branch'
      }));
      return null;
    }

    setLocationStatus(prev => ({ ...prev, checking: true, error: undefined }));

    try {
      const result = await improvedLocationService.checkWorkLocation(
        branchLocation.latitude,
        branchLocation.longitude,
        branchLocation.radius_meters || 50
      );

      if (result) {
        setLocationStatus(prev => ({
          ...prev,
          checking: false,
          withinRadius: result.isWithinRadius,
          distance: result.distance,
          accuracy: result.accuracy,
          lastChecked: new Date()
        }));

        return result.userCoords;
      }
    } catch (error: any) {
      setLocationStatus(prev => ({
        ...prev,
        checking: false,
        error: error.message || 'Failed to get your location',
        needsPermission: error.message?.includes('denied') || error.message?.includes('permission')
      }));
    }

    return null;
  };

  const handleClockIn = async () => {
    if (!userBranchId) {
      alert('No branch assigned. Please contact your administrator.');
      return;
    }

    // Automatically request permission if we don't have it
    if (!locationStatus.hasPermission) {
      console.log('🌍 Auto-requesting location permission for clock in...');
      const permissionGranted = await requestLocationPermission();
      if (!permissionGranted) {
        return; // Permission denied, stop here
      }
    }

    setLoading(true);

    try {
      // Get user's current location
      const userCoords = await checkUserLocation();
      if (!userCoords) {
        alert('Could not verify your location. Please try again.');
        setLoading(false);
        return;
      }

      // Check if user is within radius
      if (!locationStatus.withinRadius) {
        const distance = improvedLocationService.formatDistance(locationStatus.distance || 0);
        const proceed = confirm(
          `You are ${distance} away from your workplace. Are you sure you want to clock in?`
        );
        if (!proceed) {
          setLoading(false);
          return;
        }
      }

      // Clock in
      console.log('🕐 Attempting to clock in with data:', {
        user_id: userId,
        branch_id: userBranchId,
        coordinates: userCoords
      });
      
      const { data, error } = await timeTrackingService.clockIn({
        user_id: userId,
        branch_id: userBranchId,
        clock_in_latitude: userCoords.latitude,
        clock_in_longitude: userCoords.longitude,
        notes: notes.trim() || undefined
      });

      console.log('📊 Clock-in response:', { data, error });

      if (error) {
        console.error('❌ Clock-in failed:', error);
        alert('Failed to clock in: ' + error.message);
      } else {
        console.log('✅ Clock-in successful, updating state...');
        setCurrentEntry(data);
        setNotes('');
        setShowNotes(false);
        const locationMsg = locationStatus.withinRadius ? '' : ' (location exception - please speak with your supervisor)';
        alert(`✅ Successfully clocked in${locationMsg}!`);
        
        // Force refresh to ensure UI updates with retry logic
        const refreshWithRetry = async (retryCount = 0) => {
          console.log(`🔄 Force refreshing current entry (attempt ${retryCount + 1})...`);
          
          try {
            const { data, error } = await timeTrackingService.getCurrentTimeEntry(userId);
            if (error) {
              console.error(`❌ Refresh attempt ${retryCount + 1} failed:`, error);
              if (retryCount < 2) {
                console.log(`⏳ Retrying in ${1000 * (retryCount + 1)}ms...`);
                setTimeout(() => refreshWithRetry(retryCount + 1), 1000 * (retryCount + 1));
              }
            } else {
              console.log(`✅ Refresh attempt ${retryCount + 1} successful:`, data);
              setCurrentEntry(data);
            }
          } catch (error) {
            console.error(`❌ Exception on refresh attempt ${retryCount + 1}:`, error);
            if (retryCount < 2) {
              setTimeout(() => refreshWithRetry(retryCount + 1), 1000 * (retryCount + 1));
            }
          }
        };
        
        setTimeout(() => refreshWithRetry(), 1000); // Wait 1 second before first attempt
      }
    } catch (error: any) {
      alert('Error clocking in: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    console.log('🚪 Clock-out initiated');
    
    if (!currentEntry) {
      console.log('❌ No current entry found for clock-out');
      alert('No active time entry found. Please refresh the page.');
      return;
    }

    console.log('⏰ Current entry for clock-out:', currentEntry);

    const confirmClockOut = confirm(
      `Are you sure you want to clock out?\n\nWorking time: ${workingHours}`
    );
    
    if (!confirmClockOut) {
      console.log('🚫 Clock-out cancelled by user');
      return;
    }

    console.log('✅ User confirmed clock-out, proceeding...');
    setLoading(true);

    try {
      // Try to get location for clock out
      console.log('📍 Getting location for clock-out...');
      const userCoords = await checkUserLocation();
      console.log('📍 Clock-out location:', userCoords);
      
      if (!userCoords) {
        // Allow clock out even if location fails
        console.log('⚠️ Location failed, asking user to proceed anyway...');
        const proceedAnyway = confirm(
          'Could not verify your location. Do you want to clock out anyway?'
        );
        if (!proceedAnyway) {
          console.log('🚫 User cancelled clock-out due to location');
          setLoading(false);
          return;
        }
      }

      console.log('🕐 Attempting to clock out with data:', {
        timeEntryId: currentEntry.id,
        clockOutData: {
          clock_out_latitude: userCoords?.latitude || 0,
          clock_out_longitude: userCoords?.longitude || 0,
          notes: notes.trim() || undefined
        }
      });

      const { data, error } = await timeTrackingService.clockOut(currentEntry.id, {
        clock_out_latitude: userCoords?.latitude || 0,
        clock_out_longitude: userCoords?.longitude || 0,
        notes: notes.trim() || undefined
      });

      console.log('📊 Clock-out response:', { data, error });

      if (error) {
        console.error('❌ Clock-out failed:', error);
        alert('Failed to clock out: ' + error.message);
      } else {
        console.log('✅ Clock-out successful, updating state...');
        setCurrentEntry(null);
        setNotes('');
        setShowNotes(false);
        alert(`✅ Successfully clocked out!\n\nTotal working time: ${data?.total_hours?.toFixed(1)}h`);
        
        // Force refresh to ensure UI updates with retry logic
        const refreshWithRetry = async (retryCount = 0) => {
          console.log(`🔄 Force refreshing after clock-out (attempt ${retryCount + 1})...`);
          try {
            const { data, error } = await timeTrackingService.getCurrentTimeEntry(userId);
            if (error) {
              console.error(`❌ Refresh attempt ${retryCount + 1} failed:`, error);
              if (retryCount < 2) {
                console.log(`⏳ Retrying in ${1000 * (retryCount + 1)}ms...`);
                setTimeout(() => refreshWithRetry(retryCount + 1), 1000 * (retryCount + 1));
              }
            } else {
              console.log(`✅ Refresh attempt ${retryCount + 1} successful:`, data);
              setCurrentEntry(data);
            }
          } catch (error) {
            console.error(`❌ Exception on refresh attempt ${retryCount + 1}:`, error);
            if (retryCount < 2) {
              setTimeout(() => refreshWithRetry(retryCount + 1), 1000 * (retryCount + 1));
            }
          }
        };
        setTimeout(() => refreshWithRetry(), 1000);
      }
    } catch (error: any) {
      console.error('❌ Exception during clock-out:', error);
      alert('Error clocking out: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartBreak = async () => {
    if (!currentEntry) return;

    setBreakLoading(true);
    try {
      const { data, error } = await timeTrackingService.startBreak({
        time_entry_id: currentEntry.id,
        break_type: 'break',
        notes: notes.trim() || undefined
      });

      if (error) {
        console.error('❌ Failed to start break:', error);
        alert('Failed to start break: ' + error.message);
      } else {
        console.log('✅ Break started successfully:', data);
        setCurrentBreak(data);
        setNotes('');
        setShowNotes(false);
        alert('✅ Break started!');
      }
    } catch (error: any) {
      console.error('❌ Exception starting break:', error);
      alert('Error starting break: ' + error.message);
    } finally {
      setBreakLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (!currentBreak) return;

    setBreakLoading(true);
    try {
      const { data, error } = await timeTrackingService.endBreak(currentBreak.id);

      if (error) {
        console.error('❌ Failed to end break:', error);
        alert('Failed to end break: ' + error.message);
      } else {
        console.log('✅ Break ended successfully:', data);
        setCurrentBreak(null);
        alert('✅ Break ended!');
      }
    } catch (error: any) {
      console.error('❌ Exception ending break:', error);
      alert('Error ending break: ' + error.message);
    } finally {
      setBreakLoading(false);
    }
  };

  const getStatusColor = () => {
    if (currentEntry) return 'bg-green-500';
    return 'bg-gray-400';
  };

  const getStatusText = () => {
    if (currentEntry) return 'CLOCKED IN';
    return 'CLOCKED OUT';
  };

  const getLocationStatusIcon = () => {
    if (locationStatus.checking) {
      return <span className="text-sm font-medium">Checking...</span>;
    }
    
    if (locationStatus.error) {
      return <span className="text-sm font-medium">Error</span>;
    }
    
    if (locationStatus.withinRadius) {
      return <span className="text-sm font-medium">OK</span>;
    }
    
    return <span className="text-sm font-medium">Location</span>;
  };

  const getLocationStatusMessage = () => {
    if (locationStatus.checking) {
      return 'Checking your location...';
    }
    
    if (locationStatus.error) {
      return locationStatus.error;
    }
    
    if (!branchLocation) {
      return 'No workplace location configured';
    }
    
    if (locationStatus.distance !== undefined) {
      return improvedLocationService.getLocationStatusMessage(
        locationStatus.withinRadius,
        locationStatus.distance,
        branchLocation.radius_meters || 50
      );
    }
    
    return 'Location not checked yet';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">Time Tracking</h3>
        <div className="text-2xl md:text-3xl font-mono font-bold text-indigo-600">
          {currentTime}
        </div>
        {workingHours && (
          <div className="text-sm text-gray-500 mt-1">
            Working: {workingHours}
          </div>
        )}
        <div className="mt-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Location Required for Clock In/Out
          </span>
        </div>
      </div>

      {/* Status Display */}
      <div className="text-center">
        <div className={`inline-flex items-center px-4 py-2 rounded-full text-white font-medium ${getStatusColor()}`}>
          <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
          {getStatusText()}
        </div>
        
        {currentEntry && workingHours && (
          <div className="mt-3 text-sm text-gray-600">
            Working for: <span className="font-semibold text-indigo-600">{workingHours}</span>
          </div>
        )}
        
        {currentEntry?.clock_in_time && (
          <div className="mt-1 text-xs text-gray-500">
            Started at: {new Date(currentEntry.clock_in_time).toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        )}
      </div>

      {/* Location Permission Status - Only show if permission explicitly denied */}
      {!locationStatus.hasPermission && showPermissionDialog && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600 font-bold text-xs border border-amber-600 rounded-full flex items-center justify-center">!</div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-800">Location Access Needed</h4>
              <p className="text-sm text-amber-700 mt-1">
                Location access was denied. To use time tracking, please enable location permissions.
              </p>
              
              <div className="mt-3 p-3 bg-amber-100 rounded-lg">
                <p className="text-xs text-amber-800 font-medium mb-2">
                  {improvedLocationService.getBrowserInstructions()}
                </p>
                
                <div className="mt-2 p-2 bg-amber-200 rounded text-xs text-amber-900">
                  <strong>No popup dialog?</strong> Manually enable location:
                  <br />• Chrome: Click the lock icon in address bar → Location → Allow
                  <br />• Safari: Safari → Settings → Websites → Location → Allow  
                  <br />• Firefox: Click shield icon → Location → Allow
                  <br />Then click "Try Again" below.
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <button
                  onClick={requestLocationPermission}
                  disabled={requestingPermission}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400 flex items-center justify-center space-x-2"
                >
                  {requestingPermission ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Requesting Permission...</span>
                    </>
                  ) : (
                    <>
                      <span>Location</span>
                      <span>Try Again</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowPermissionDialog(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Status - Always show when location is required */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Location Status</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={locationStatus.hasPermission ? checkUserLocation : requestLocationPermission}
              disabled={locationStatus.checking || requestingPermission}
              className="text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
            >
              {(locationStatus.checking || requestingPermission) ? (
                <>
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{requestingPermission ? 'Requesting...' : 'Checking...'}</span>
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{locationStatus.hasPermission ? 'Check Location' : 'Try Again'}</span>
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="flex items-start space-x-2">
          {getLocationStatusIcon()}
          <div className="flex-1 text-xs text-gray-600">
            {getLocationStatusMessage()}
            {locationStatus.accuracy && (
              <div className="mt-1 text-gray-500">
                GPS accuracy: {improvedLocationService.formatAccuracy(locationStatus.accuracy)}
              </div>
            )}
            {locationStatus.lastChecked && (
              <div className="mt-1 text-gray-500">
                Last checked: {locationStatus.lastChecked.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="border-t pt-4">
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <span>Add Note (Optional)</span>
          <svg 
            className={`w-4 h-4 transform transition-transform ${showNotes ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showNotes && (
          <div className="mt-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about your work shift..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              rows={3}
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="border-t pt-4 space-y-3">
        {currentEntry ? (
          <button
            onClick={handleClockOut}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 md:py-4 px-4 md:px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 text-base md:text-lg"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Clock Out</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleClockIn}
            disabled={loading || !userBranchId}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 md:py-4 px-4 md:px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 text-base md:text-lg"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Clock In with Location</span>
              </>
            )}
          </button>
        )}

        {/* Break Controls */}
        {currentEntry && !currentEntry.clock_out_time && (
          <div className="grid grid-cols-1 gap-2">
            {currentBreak ? (
              <button
                onClick={handleEndBreak}
                disabled={breakLoading}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {breakLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>End Break</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleStartBreak}
                disabled={breakLoading}
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {breakLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-10 5V7a3 3 0 013-3h4a3 3 0 013 3v12l-5-3-5 3z" />
                    </svg>
                    <span>Take a Break</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
        
        {!userBranchId && (
          <div className="text-xs text-center text-red-600">
            No branch assigned - contact your administrator
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {currentEntry && (
        <div className="border-t pt-4">
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Branch:</span>
              <span className="font-medium">{currentEntry.branch?.branch_name || 'Unknown'}</span>
            </div>
            {currentEntry.clock_in_latitude && currentEntry.clock_in_longitude && (
              <div className="flex justify-between">
                <span>Clock-in location:</span>
                <span className="font-mono text-xs">
                  {currentEntry.clock_in_latitude.toFixed(4)}, {currentEntry.clock_in_longitude.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImprovedClockInOut;