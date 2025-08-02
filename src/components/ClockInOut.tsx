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

  // Load initial data
  useEffect(() => {
    loadCurrentEntry();
    if (userBranchId) {
      loadBranchLocation();
    }
  }, [userId, userBranchId]);

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

  const checkLocation = async (): Promise<Coordinates | null> => {
    if (!branchLocation) {
      setLocationStatus({
        isChecking: false,
        isWithinRadius: false,
        error: 'No work location configured for your branch'
      });
      return null;
    }

    setLocationStatus({ isChecking: true, isWithinRadius: false });

    try {
      const result = await LocationUtils.checkWorkLocation(
        branchLocation.latitude,
        branchLocation.longitude,
        branchLocation.radius_meters
      );

      setLocationStatus({
        isChecking: false,
        isWithinRadius: result.isWithinRadius,
        distance: result.distance,
        accuracy: result.accuracy
      });

      return result.userCoords;
    } catch (error: any) {
      let errorMessage = error.message || 'Failed to get location';
      
      // Provide specific guidance for permission denied errors
      if (error.type === 'PERMISSION_DENIED' || error.message?.includes('denied')) {
        errorMessage = 'Location access denied. Please enable location permissions in your browser settings and refresh the page.';
        setShowPermissionHelp(true);
      }
      
      setLocationStatus({
        isChecking: false,
        isWithinRadius: false,
        error: errorMessage
      });
      return null;
    }
  };

  const handleClockIn = async () => {
    if (!userBranchId) {
      alert('No branch assigned. Please contact your administrator.');
      return;
    }

    setLoading(true);
    
    try {
      const userCoords = await checkLocation();
      if (!userCoords) {
        setLoading(false);
        return;
      }

      if (!locationStatus.isWithinRadius) {
        const proceed = confirm(
          `You are ${locationService.formatDistance(locationStatus.distance || 0)} away from your workplace. ` +
          `Are you sure you want to clock in?`
        );
        if (!proceed) {
          setLoading(false);
          return;
        }
      }

      const { data, error } = await timeTrackingService.clockIn({
        branch_id: userBranchId,
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        notes: notes.trim() || undefined
      });

      if (error) {
        alert('Failed to clock in: ' + error.message);
      } else {
        setCurrentEntry(data);
        setNotes('');
        setShowNotes(false);
        // Success feedback
        if (locationStatus.isWithinRadius) {
          alert('✅ Successfully clocked in!');
        } else {
          alert('⚠️ Clocked in with location exception - please speak with your supervisor.');
        }
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
      const userCoords = await checkLocation();
      if (!userCoords) {
        // Allow clock out even if location fails
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
        alert(`✅ Successfully clocked out!\n\nTotal working time: ${data?.total_hours?.toFixed(1)}h`);
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

  const requestLocationPermission = async () => {
    try {
      setShowPermissionHelp(false);
      await checkLocation();
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
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
    if (locationStatus.isChecking) return 'Checking location...';
    if (locationStatus.error) return locationStatus.error;
    if (!branchLocation) return 'No work location set';
    
    return LocationUtils.getLocationStatusMessage(
      locationStatus.isWithinRadius,
      locationStatus.distance || 0,
      branchLocation.radius_meters
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Time Tracking</h3>
        <div className="text-2xl font-mono font-bold text-indigo-600">
          {currentTime}
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

      {/* Location Status */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Location Status</span>
          <button
            onClick={checkLocation}
            disabled={locationStatus.isChecking}
            className="text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          >
            Refresh
          </button>
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
          </div>
        </div>
      </div>

      {/* Permission Help Section */}
      {showPermissionHelp && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-800">Location Permission Required</h4>
              <p className="text-sm text-amber-700 mt-1">
                To clock in/out, please enable location access in your browser:
              </p>
              <ol className="text-sm text-amber-700 mt-2 ml-4 list-decimal list-inside space-y-1">
                <li>Click the location icon (🔒) in your browser's address bar</li>
                <li>Select "Allow" for location access</li>
                <li>Refresh this page or click "Try Again" below</li>
              </ol>
              <div className="flex space-x-2 mt-3">
                <button
                  onClick={requestLocationPermission}
                  className="px-3 py-1 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700"
                >
                  Try Again
                </button>
                <button
                  onClick={() => setShowPermissionHelp(false)}
                  className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
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
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
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
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Clock In</span>
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