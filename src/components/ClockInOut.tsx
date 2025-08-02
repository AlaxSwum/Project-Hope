import React, { useState, useEffect } from 'react';
import { timeTrackingService, TimeEntry, BranchLocation } from '../lib/supabase-secure';
import { branchService } from '../lib/branch-service';
import { locationService, LocationUtils, Coordinates } from '../lib/location-service';

interface ClockInOutProps {
  userId: string;
  userBranchId?: string;
}

interface LocationStatus {
  isChecking: boolean;
  isWithinRadius: boolean;
  distance?: number;
  accuracy?: number;
  error?: string;
  strategy?: string;
  lastUpdated?: Date;
}

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

const ClockInOut: React.FC<ClockInOutProps> = ({ userId, userBranchId }) => {
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [branchLocation, setBranchLocation] = useState<BranchLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>({
    isChecking: false,
    isWithinRadius: false
  });
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [workingHours, setWorkingHours] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showNotes, setShowNotes] = useState(false);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [sessionLocation, setSessionLocation] = useState<Coordinates | null>(null);
  const [sessionLocationTime, setSessionLocationTime] = useState<number | null>(null);
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
      const interval = setInterval(updateWorkingHours, 60000); // Update every minute
      return () => clearInterval(interval);
    } else {
      setWorkingHours('');
    }
  }, [currentEntry]);

  // Load initial data and check location permission
  useEffect(() => {
    loadCurrentEntry();
    if (userBranchId) {
      loadBranchLocation();
    }
    checkLocationPermissionStatus();
    
    // Load session location if available (valid for work session)
    const sessionData = localStorage.getItem('hope-session-location');
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        const age = Date.now() - parsed.timestamp;
        
        // Session location valid for 8 hours (work session)
        if (age < 8 * 60 * 60 * 1000) {
          setSessionLocation({
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            accuracy: parsed.accuracy
          });
          setSessionLocationTime(parsed.timestamp);
          console.log('Loaded session location:', parsed);
        } else {
          // Remove old session
          localStorage.removeItem('hope-session-location');
          console.log('Session location expired, cleared');
        }
      } catch (error) {
        console.error('Error loading session location:', error);
        localStorage.removeItem('hope-session-location');
      }
    }
    
    // Clear old cache formats
    localStorage.removeItem('hope-last-location');
    localStorage.removeItem('hope-manual-location');
    
    // Listen for when user returns to tab (helpful if they went to browser settings)
    const handleVisibilityChange = () => {
      if (!document.hidden && permissionStatus === 'denied') {
        // User came back to tab, recheck permission status
        setTimeout(() => {
          checkLocationPermissionStatus();
        }, 1000);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, userBranchId, permissionStatus]);

  // Load current break status
  useEffect(() => {
    if (currentEntry) {
      loadCurrentBreak();
    }
  }, [currentEntry]);

  const loadCurrentEntry = async () => {
    try {
      const { data, error } = await timeTrackingService.getCurrentTimeEntry(userId);
      if (error) {
        console.error('Error loading current entry:', error);
      } else {
        setCurrentEntry(data);
      }
    } catch (error) {
      console.error('Error loading current entry:', error);
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
      // Check if there's an active break for the current time entry
      const { data, error } = await timeTrackingService.getActiveBreak(currentEntry.id);
      if (error) {
        console.error('Error loading current break:', error);
      } else {
        setCurrentBreak(data);
      }
    } catch (error) {
      console.error('Error loading current break:', error);
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
        alert('Failed to start break: ' + error.message);
      } else {
        setCurrentBreak(data);
        setNotes('');
        setShowNotes(false);
        alert('✅ Break started!');
      }
    } catch (error: any) {
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
        alert('Failed to end break: ' + error.message);
      } else {
        setCurrentBreak(null);
        alert('✅ Break ended!');
      }
    } catch (error: any) {
      alert('Error ending break: ' + error.message);
    } finally {
      setBreakLoading(false);
    }
  };

  // Session-based location tracking
  const getCurrentLocation = async (): Promise<Coordinates | null> => {
    console.log('🔍 Getting location...');
    
    // 1. Use session location if available (within 8 hours)
    if (sessionLocation && sessionLocationTime) {
      const age = Date.now() - sessionLocationTime;
      if (age < 8 * 60 * 60 * 1000) { // 8 hours
        console.log('✅ Using session location:', sessionLocation);
        return sessionLocation;
      } else {
        console.log('Session location expired, getting fresh GPS...');
        setSessionLocation(null);
        setSessionLocationTime(null);
        localStorage.removeItem('hope-session-location');
      }
    }
    
    // 2. Get fresh GPS and save as session location
    console.log('🔍 Getting fresh GPS for session...');
    
    // Try high accuracy first
    try {
      const coords = await getLocationWithOptions({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0 // Always fresh for session capture
      });
      
      // Save as session location
      saveSessionLocation(coords);
      return coords;
      
    } catch (highAccuracyError) {
      console.log('High accuracy GPS failed, trying balanced approach...');
      
      // Fallback to balanced approach
      try {
        const coords = await getLocationWithOptions({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000
        });
        
        // Save as session location
        saveSessionLocation(coords);
        return coords;
        
      } catch (balancedError) {
        console.log('Balanced GPS failed, trying fast/low accuracy...');
        
        // Final fallback to fast/low accuracy
        const coords = await getLocationWithOptions({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 30000
        });
        
        // Save as session location
        saveSessionLocation(coords);
        return coords;
      }
    }
  };

  // Save location for work session
  const saveSessionLocation = (coords: Coordinates) => {
    const timestamp = Date.now();
    
    setSessionLocation(coords);
    setSessionLocationTime(timestamp);
    
    localStorage.setItem('hope-session-location', JSON.stringify({
      ...coords,
      timestamp,
      savedAt: new Date().toLocaleString()
    }));
    
    console.log('✅ Session location saved:', coords);
  };

  // Helper function for GPS with specific options
  const getLocationWithOptions = async (options: PositionOptions): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          
          console.log('✅ GPS location obtained:', coords);
          console.log('Accuracy:', coords.accuracy + 'm');
          resolve(coords);
        },
        (error) => {
          console.log('❌ GPS attempt failed:', error);
          reject(error);
        },
        options
      );
    });
  };

  const checkLocation = async (): Promise<Coordinates | null> => {
    console.log('checkLocation called - branch location:', branchLocation);
    console.log('Current permission status:', permissionStatus);
    console.log('Checking location...');
    
    if (!branchLocation) {
      setLocationStatus({
        isChecking: false,
        isWithinRadius: false,
        error: 'No work location configured for your branch'
      });
      return null;
    }

    setLocationStatus({ 
      isChecking: true, 
      isWithinRadius: false,
      lastUpdated: new Date()
    });

    try {
      // Use session-based location detection
      const userCoords = await getCurrentLocation();

      if (!userCoords) {
        throw new Error('Unable to get location');
      }

      // Check if location is within work radius
      const result = await LocationUtils.checkWorkLocation(
        branchLocation.latitude,
        branchLocation.longitude,
        branchLocation.radius_meters
      );
      
      // If the LocationUtils doesn't return userCoords, use our own
      if (!result.userCoords) {
        result.userCoords = userCoords;
      }

      setLocationStatus({
        isChecking: false,
        isWithinRadius: result.isWithinRadius,
        distance: result.distance,
        accuracy: userCoords.accuracy,
        lastUpdated: new Date()
      });

      return userCoords;
    } catch (error: any) {
      let errorMessage = error.message || 'Failed to get location';
      
      console.log('Location error details:', { code: error.code, message: error.message, type: error.type });
      
      // If we have session location and this is just a refresh failure, use session location
      if (sessionLocation && sessionLocationTime) {
        const age = Date.now() - sessionLocationTime;
        if (age < 8 * 60 * 60 * 1000) { // Still within 8 hours
          console.log('GPS refresh failed, but using valid session location');
          
          // Check session location against workplace
          const result = await LocationUtils.checkWorkLocation(
            branchLocation.latitude,
            branchLocation.longitude,
            branchLocation.radius_meters
          );
          
          if (!result.userCoords) {
            result.userCoords = sessionLocation;
          }

          setLocationStatus({
            isChecking: false,
            isWithinRadius: result.isWithinRadius,
            distance: result.distance,
            accuracy: sessionLocation.accuracy,
            lastUpdated: new Date(),
            error: 'Using session location (GPS refresh failed)'
          });

          return sessionLocation;
        }
      }
      
      // Only show permission help for actual permission errors AND only if we don't already have permission
      if ((error.type === 'PERMISSION_DENIED' || (error.code && error.code === 1)) && permissionStatus !== 'granted') {
        errorMessage = 'Location access denied. Please enable location permissions and try again.';
        setPermissionStatus('denied');
        setShowPermissionHelp(true);
      } else if (error.type === 'TIMEOUT' || (error.code && error.code === 3)) {
        errorMessage = sessionLocation 
          ? 'Session location refresh timed out. Try again to update location.'
          : 'Session location setup timed out. Please try again or move to an area with better GPS signal.';
      } else if (error.type === 'POSITION_UNAVAILABLE' || (error.code && error.code === 2)) {
        errorMessage = sessionLocation
          ? 'GPS unavailable for refresh. Session location still active.'
          : 'GPS location service is unavailable. Please ensure location services are enabled for session setup.';
      } else {
        // For other errors, provide helpful context
        if (permissionStatus === 'granted') {
          errorMessage = sessionLocation 
            ? 'Session location refresh failed. Try again to update location.'
            : 'Session location setup failed. Please try again or move to an area with better signal.';
        } else {
          errorMessage = `Session location error: ${error.message || 'Unable to get location'}. Please enable location permissions.`;
        }
      }
      
      setLocationStatus({
        isChecking: false,
        isWithinRadius: false,
        error: errorMessage,
        lastUpdated: new Date()
      });
      
      return null;
    }
  };

  const handleClockIn = async () => {
    if (!userBranchId) {
      alert('No branch assigned. Please contact your administrator.');
      return;
    }

    console.log('Clock in attempt - current permission status:', permissionStatus);
    
    // First, ensure we have location permission
    const hasPermission = await handleLocationRequest();
    console.log('Permission check result:', hasPermission);
    if (!hasPermission) {
      console.log('Permission check failed, aborting clock in');
      return;
    }

    setLoading(true);
    
    try {
      // Always require location
      const userCoords = await checkLocation();
      if (!userCoords) {
        setLoading(false);
        return;
      }

      let locationMessage = '';
      if (!locationStatus.isWithinRadius) {
        const proceed = confirm(
          `You are ${locationService.formatDistance(locationStatus.distance || 0)} away from your workplace. ` +
          `Are you sure you want to clock in?`
        );
        if (!proceed) {
          setLoading(false);
          return;
        }
        locationMessage = ' with location exception - please speak with your supervisor';
      }

      const { data, error } = await timeTrackingService.clockIn({
        user_id: userId,
        branch_id: userBranchId,
        clock_in_latitude: userCoords.latitude,
        clock_in_longitude: userCoords.longitude,
        notes: notes.trim() || undefined
      });

      if (error) {
        alert('Failed to clock in: ' + error.message);
      } else {
        setCurrentEntry(data);
        setNotes('');
        setShowNotes(false);
        alert(`✅ Successfully clocked in${locationMessage}!`);
      }
    } catch (error: any) {
      alert('Error clocking in: ' + error.message);
    } finally {
      setLoading(false);
    }
  };



  const handleClockOut = async () => {
    if (!currentEntry) return;

    const confirmClockOut = confirm(
      `Are you sure you want to clock out?\n\nWorking time: ${workingHours}`
    );
    
    if (!confirmClockOut) return;

    setLoading(true);

    try {
      // Always require location for clock out
      const userCoords = await checkLocation();
      if (!userCoords) {
        // Allow clock out even if location fails for business continuity
        const proceedAnyway = confirm(
          'Could not verify your location. Do you want to clock out anyway?'
        );
        if (!proceedAnyway) {
          setLoading(false);
          return;
        }
      }

      const { data, error } = await timeTrackingService.clockOut(currentEntry.id, {
        latitude: userCoords?.latitude || 0,
        longitude: userCoords?.longitude || 0,
        notes: notes.trim() || undefined
      });

      if (error) {
        alert('Failed to clock out: ' + error.message);
      } else {
        setCurrentEntry(null);
        setNotes('');
        setShowNotes(false);
        alert(`✅ Successfully clocked out with location!\n\nTotal working time: ${data?.total_hours?.toFixed(1)}h`);
      }
    } catch (error: any) {
      alert('Error clocking out: ' + error.message);
    } finally {
      setLoading(false);
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

  // Check current location permission status
  const checkLocationPermissionStatus = async () => {
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionStatus(permission.state);
        
        // If permission is already granted, hide any help dialogs
        if (permission.state === 'granted') {
      setShowPermissionHelp(false);
          setShowPermissionDialog(false);
        }
        
        // Listen for permission changes
        permission.onchange = () => {
          const newState = permission.state;
          setPermissionStatus(newState);
          
          // Auto-hide help when permission is granted
          if (newState === 'granted') {
            setShowPermissionHelp(false);
            setShowPermissionDialog(false);
            
            // Auto-check location when permission is granted
            setTimeout(() => {
              checkLocation();
            }, 1000);
          }
        };
      } else {
        // Fallback for browsers without Permissions API (like Safari)
        // For Safari, we'll be optimistic and assume permission is available
        // We'll only set it to denied if we get an actual permission error later
        console.log('Browser does not support Permissions API (likely Safari), assuming permission available');
        setPermissionStatus('granted');
        setShowPermissionHelp(false);
        setShowPermissionDialog(false);
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
      setPermissionStatus('unknown');
    }
  };

  // Actively request location permission with native browser dialog
  const requestLocationPermission = async (): Promise<boolean> => {
    setIsRequestingPermission(true);
    setShowPermissionDialog(false);
    
    return new Promise((resolve) => {
      // More mobile-friendly settings
      const options = {
        enableHighAccuracy: false, // Less battery intensive, works better on mobile
        timeout: 15000, // Longer timeout for mobile
        maximumAge: 300000 // 5 minutes cache
      };
      
      // This will trigger the browser's native permission dialog
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Success - permission granted and location obtained
          setPermissionStatus('granted');
          setShowPermissionHelp(false);
          setIsRequestingPermission(false);
          console.log('Location permission granted and position obtained:', position.coords);
          resolve(true);
        },
        (error) => {
          // Error - permission denied or other issue
          setIsRequestingPermission(false);
          console.error('Location permission error:', error);
          
          if (error.code === 1) { // PERMISSION_DENIED
            setPermissionStatus('denied');
            setShowPermissionHelp(true);
            
            // More helpful alert with specific browser guidance
            const userAgent = navigator.userAgent;
            let browserGuidance = '';
            
            if (userAgent.includes('Chrome')) {
              browserGuidance = '\n\n📱 Chrome: Tap the location icon 🌍 in the address bar → Allow';
            } else if (userAgent.includes('Safari')) {
              browserGuidance = '\n\n📱 Safari: Settings → Privacy & Security → Location Services → Safari Websites → hopeims.com → Allow';
            } else if (userAgent.includes('Firefox')) {
              browserGuidance = '\n\n📱 Firefox: Tap the shield icon → Location → Allow';
            } else if (userAgent.includes('Edge')) {
              browserGuidance = '\n\n📱 Edge: Tap the location icon in the address bar → Allow';
            } else {
              browserGuidance = '\n\n📱 Look for the location icon (🌍 or 📍) in your browser and tap Allow';
            }
            
            alert(`🔐 Location Permission Required\n\nTo clock in/out, we need your location to verify you're at work.${browserGuidance}\n\n✅ After allowing, try the "Clock In" button again!`);
            resolve(false);
          } else if (error.code === 2) { // POSITION_UNAVAILABLE
            alert('⚠️ Location service is unavailable. Please check that location services are enabled on your device and try again.');
            resolve(false);
          } else if (error.code === 3) { // TIMEOUT
            alert('⏱️ Location request timed out. This can happen on mobile devices. Please try again.');
            resolve(false);
          } else {
            alert(`❌ Location error (${error.code}): ${error.message}. Please try again.`);
            resolve(false);
          }
        },
        options
      );
    });
  };

  // Smart location permission handler
  const handleLocationRequest = async () => {
    // Check if geolocation is supported
    if (!('geolocation' in navigator)) {
      alert('❌ Location services are not supported by your browser.');
      return false;
    }

    // If already granted, we trust the permission status for now
    // Don't do permission testing here as it causes false negatives
    if (permissionStatus === 'granted') {
      console.log('Permission already granted, proceeding with location check');
      return true;
    }

    // If explicitly denied, show help
    if (permissionStatus === 'denied') {
      setShowPermissionHelp(true);
      return false;
    }

    // Request permission
    return await requestLocationPermission();
  };

  // No manual confirmation - real-time GPS only

  // Helper function to calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  };



  const getLocationStatusIcon = () => {
    if (locationStatus.isChecking) {
      return (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      );
    }
    
    if (locationStatus.error) {
      return (
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    
    if (locationStatus.isWithinRadius) {
      return (
        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    }
    
    return (
      <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  };

  const getLocationStatusMessage = () => {
    if (locationStatus.isChecking) {
      return `Checking location using ${locationStatus.strategy} mode...`;
    }
    if (locationStatus.error) return locationStatus.error;
    if (!branchLocation) return 'No work location set';
    
    let message = LocationUtils.getLocationStatusMessage(
      locationStatus.isWithinRadius,
      locationStatus.distance || 0,
      branchLocation.radius_meters
    );
    
    // Add strategy info to successful location
    if (locationStatus.strategy && !locationStatus.error) {
      message += ` (${locationStatus.strategy} mode)`;
    }
    
    return message;
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
        {/* Location is always required */}
        <div className="mt-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Location Tracking Required
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

      {/* Location Permission Status */}
      {permissionStatus !== 'granted' && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Location Permission</span>
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                permissionStatus === 'granted' ? 'bg-green-100 text-green-800' :
                permissionStatus === 'denied' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {permissionStatus === 'granted' && '✅ Allowed'}
                {permissionStatus === 'denied' && '❌ Denied'}
                {permissionStatus === 'prompt' && '⏳ Prompt'}
                {permissionStatus === 'unknown' && '❓ Unknown'}
              </div>
            </div>
            
            <button
              onClick={() => setShowPermissionDialog(true)}
              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded font-medium"
            >
              Enable Location
            </button>
          </div>
        </div>
      )}

      {/* Location Status */}
      {(
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Location Status</span>
            <div className="flex items-center space-x-2">
          <button
            onClick={checkLocation}
            disabled={locationStatus.isChecking}
                className="text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
            {locationStatus.isChecking ? (
              <>
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Checking...</span>
              </>
            ) : (
              <>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </>
            )}
          </button>
          
          {/* Session location mode indicator */}
          <span className="text-xs text-green-600 font-medium">
            {sessionLocation ? '📍 Session Location' : '📡 Session Setup'}
          </span>

        </div>
        
        <div className="flex items-start space-x-2">
          {getLocationStatusIcon()}
          <div className="flex-1 text-xs text-gray-600">
            {getLocationStatusMessage()}
            {locationStatus.accuracy && (
              <div className="mt-1 text-gray-500">
                GPS accuracy: {LocationUtils.formatAccuracy(locationStatus.accuracy)}
              </div>
            )}
            
                        {/* Session location status */}
            {sessionLocation && sessionLocationTime && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-xs font-medium text-green-800 mb-2">✅ Session Location Active</div>
                <div className="text-xs text-green-700">
                  <strong>Location captured:</strong> {new Date(sessionLocationTime).toLocaleTimeString()}
                  <br />
                  <strong>Coordinates:</strong> {sessionLocation.latitude.toFixed(4)}, {sessionLocation.longitude.toFixed(4)}
                  {sessionLocation.accuracy && (
                    <>
                      <br />
                      <strong>Accuracy:</strong> ±{Math.round(sessionLocation.accuracy)}m
                    </>
                  )}
                  <br />
                  <strong>Valid for:</strong> Work session (8 hours)
                  <br />
                  <br />
                  💡 <em>Using this location for all clock-ins until session expires</em>
                </div>
              </div>
            )}

            {/* GPS setup info - shows when no session and location fails */}
            {!sessionLocation && locationStatus.error && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs font-medium text-blue-800 mb-2">📍 Session Location Setup</div>
                <div className="text-xs text-blue-700">
                  <strong>First-time setup needed:</strong>
                  <br />
                  Once location is captured, it will be used for your entire work session (8 hours)
                  <br />
                  <br />
                  <strong>The system tries 3 approaches:</strong>
                  <br />
                  1. 📡 High accuracy GPS (20 seconds)
                  <br />
                  2. ⚖️ Balanced GPS (15 seconds)  
                  <br />
                  3. ⚡ Fast GPS (10 seconds)
                  <br />
                  <br />
                  <strong>Troubleshooting:</strong>
                  <br />
                  • Ensure location services are enabled
                  <br />
                  • Try moving closer to a window or outdoors
                  <br />
                  • Once captured, no more GPS needed for the day!
                </div>
              </div>
            )}
            
            {/* Show GPS debug info */}
            {process.env.NODE_ENV !== 'production' && locationStatus.error && (
              <details className="mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer">🔧 GPS Debug Info (Dev Only)</summary>
                <div className="mt-1 p-2 bg-gray-100 rounded text-xs">
                  <div>Permission Status: {permissionStatus}</div>
                  <div>Branch Location: {branchLocation ? 'Yes' : 'No'}</div>
                  <div>Real-time GPS Mode: Enabled</div>
                  <div>Manual/Cached Locations: Disabled</div>
                </div>
              </details>
            )}

            {/* Session location buttons */}
            {locationStatus.error && permissionStatus === 'granted' && !locationStatus.error.includes('denied') && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={async () => {
                    console.log('Setting up session location...');
                    await checkLocation();
                  }}
                  disabled={locationStatus.isChecking}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50 flex items-center space-x-2"
                >
                  {locationStatus.isChecking ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span>Setting up... (~45s)</span>
                    </>
                  ) : (
                    <>
                      <span>📍</span>
                      <span>{sessionLocation ? 'Refresh Session' : 'Setup Session Location'}</span>
                    </>
                  )}
                </button>
                
                {sessionLocation && (
                  <button
                    onClick={() => {
                      if (confirm('Clear session location? You will need to set it up again.')) {
                        setSessionLocation(null);
                        setSessionLocationTime(null);
                        localStorage.removeItem('hope-session-location');
                        console.log('Session location cleared');
                      }
                    }}
                    className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded flex items-center space-x-1"
                  >
                    <span>🗑️</span>
                    <span>Clear Session</span>
                  </button>
                )}
              </div>
            )}
          </div>
          </div>
        </div>
        </div>
      )}



      {/* Location Permission Dialog */}
      {showPermissionDialog && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-800">Enable Location Access</h4>
              <p className="text-sm text-blue-700 mt-1">
                To clock in/out, we need access to your location to verify you're at the workplace.
              </p>
              
              <div className="mt-3 p-3 bg-blue-100 rounded-md">
                <p className="text-xs text-blue-800">
                  Click "Allow Location Access" below to enable the browser's location permission dialog.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <button
                  onClick={requestLocationPermission}
                  disabled={isRequestingPermission}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 font-medium disabled:bg-gray-400 flex items-center justify-center space-x-2"
                >
                  {isRequestingPermission ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Requesting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Allow Location Access</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowPermissionDialog(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permission Help Section */}
      {showPermissionHelp && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-800">Location Permission Required</h4>
              <p className="text-sm text-amber-700 mt-1">
                To clock in/out, please enable location access:
              </p>
              
              {/* Mobile Instructions */}
              <div className="block md:hidden">
                <div className="text-sm text-amber-700 mt-2 space-y-2">
                  <p className="font-medium">Mobile Instructions:</p>
                  <ol className="ml-4 list-decimal list-inside space-y-1">
                    <li>Tap the location icon in your browser's address bar</li>
                    <li>Select "Allow" when prompted</li>
                    <li>Or go to Settings → Privacy → Location Services</li>
                    <li>Enable location for your browser</li>
                  </ol>
                </div>
              </div>

              {/* Desktop Instructions */}
              <div className="hidden md:block">
                <div className="text-sm text-amber-700 mt-2 space-y-2">
                  <p className="font-medium">Desktop Instructions:</p>
                  <ol className="ml-4 list-decimal list-inside space-y-1">
                    <li>Click the location icon in your browser's address bar</li>
                <li>Select "Allow" for location access</li>
                    <li>Or check browser settings → Privacy & Security → Location</li>
              </ol>
                </div>
              </div>

              <div className="mt-3 p-3 bg-amber-100 rounded-md">
                <p className="text-xs text-amber-800">
                  <strong>Location is required</strong> to clock in/out. Please enable location permissions and try again.
                </p>
                
                {/* Browser-specific quick guidance */}
                <div className="mt-2 text-xs text-amber-700">
                  <p className="font-medium">Quick Fix:</p>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <span>1.</span>
                      <span>Look for the location icon (🌍 or 📍) in your browser's address bar</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span>2.</span>
                      <span>Click it and select "Allow" or "Allow location access"</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span>3.</span>
                      <span>The page will automatically work once allowed!</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <button
                  onClick={requestLocationPermission}
                  disabled={isRequestingPermission}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 font-medium disabled:bg-gray-400 flex items-center justify-center space-x-2"
                >
                  {isRequestingPermission ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Requesting...</span>
                    </>
                  ) : (
                    <span>Try Again</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    // Try to open browser settings (works in some browsers)
                    if ('chrome' in window) {
                      // Chrome-specific settings URL
                      window.open('chrome://settings/content/location', '_blank');
                    } else {
                      // Fallback: just refresh and hope user enabled it
                      window.location.reload();
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 font-medium"
                >
                  Open Settings
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 font-medium"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => setShowPermissionHelp(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Action Button */}
      <div className="border-t pt-4">
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
        
        {/* Break Controls - Only show when clocked in */}
        {currentEntry && !currentEntry.clock_out_time && (
          <div className="mt-3">
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
          <div className="mt-2 text-xs text-center text-red-600">
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

export default ClockInOut; 