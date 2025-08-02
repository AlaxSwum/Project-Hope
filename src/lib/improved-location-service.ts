// Improved Location Service - Simple, Reliable, Mobile-Friendly
// This replaces the complex location-service.ts with a cleaner approach

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface LocationPermissionState {
  granted: boolean;
  denied: boolean;
  canPrompt: boolean;
  message: string;
}

export interface LocationResult {
  success: boolean;
  coordinates?: LocationCoordinates;
  error?: string;
  needsPermission?: boolean;
}

export interface LocationCheckResult {
  isWithinRadius: boolean;
  distance: number;
  userCoords: LocationCoordinates;
  accuracy?: number;
}

export class ImprovedLocationService {
  private static instance: ImprovedLocationService;
  private currentPosition: LocationCoordinates | null = null;
  private permissionState: LocationPermissionState | null = null;

  static getInstance(): ImprovedLocationService {
    if (!ImprovedLocationService.instance) {
      ImprovedLocationService.instance = new ImprovedLocationService();
    }
    return ImprovedLocationService.instance;
  }

  /**
   * Check if geolocation is supported
   */
  isSupported(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Check current permission status
   */
  async checkPermissionStatus(): Promise<LocationPermissionState> {
    if (!this.isSupported()) {
      return {
        granted: false,
        denied: true,
        canPrompt: false,
        message: 'Location services not supported by your browser'
      };
    }

    try {
      // Modern browsers with Permissions API
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        
        const state: LocationPermissionState = {
          granted: permission.state === 'granted',
          denied: permission.state === 'denied',
          canPrompt: permission.state === 'prompt',
          message: this.getPermissionMessage(permission.state)
        };

        this.permissionState = state;
        return state;
      } 
      // Fallback for older browsers (like older Safari)
      else {
        // We assume we can prompt unless we get an actual error
        return {
          granted: false,
          denied: false,
          canPrompt: true,
          message: 'Ready to request location permission'
        };
      }
    } catch (error) {
      return {
        granted: false,
        denied: false,
        canPrompt: true,
        message: 'Unable to determine permission status'
      };
    }
  }

  /**
   * Request location permission and get position
   * This is the main method that combines permission request + location fetch
   */
  async requestLocationAccess(): Promise<LocationResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Location services are not supported by your browser',
        needsPermission: false
      };
    }

    console.log('🌍 Requesting location access...');

    return new Promise((resolve) => {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 20000, // 20 seconds - generous timeout for mobile
        maximumAge: 0   // Always get fresh location for permission requests
      };

      navigator.geolocation.getCurrentPosition(
        // Success callback
        (position) => {
          const coords: LocationCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          };

          this.currentPosition = coords;
          console.log('✅ Location access granted:', coords);

          resolve({
            success: true,
            coordinates: coords
          });
        },
        // Error callback
        (error) => {
          console.log('❌ Location access failed:', error);
          console.log('Error details:', {
            code: error.code,
            message: error.message,
            PERMISSION_DENIED: error.code === 1,
            POSITION_UNAVAILABLE: error.code === 2,
            TIMEOUT: error.code === 3
          });
          
          let errorMessage = 'Failed to get your location';
          let needsPermission = false;

          switch (error.code) {
            case 1: // PERMISSION_DENIED
              errorMessage = 'Location access was denied. If no popup appeared, manually enable location in browser settings and click "Try Again".';
              needsPermission = true;
              console.log('🚫 PERMISSION_DENIED - Location access blocked. Check browser settings.');
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMessage = 'Your location is currently unavailable. Please ensure location services are enabled on your device.';
              console.log('📍 POSITION_UNAVAILABLE - GPS/location services issue.');
              break;
            case 3: // TIMEOUT
              errorMessage = 'Location request timed out. Please try again or move to an area with better GPS signal.';
              console.log('⏱️ TIMEOUT - Location request took too long.');
              break;
            default:
              errorMessage = `Location error: ${error.message}`;
              console.log('❓ UNKNOWN_ERROR:', error);
          }

          resolve({
            success: false,
            error: errorMessage,
            needsPermission
          });
        },
        options
      );
    });
  }

  /**
   * Get current position (assumes permission already granted)
   */
  async getCurrentPosition(): Promise<LocationResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Location services not supported'
      };
    }

    console.log('📍 Getting current position...');

    return new Promise((resolve) => {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 15000, // 15 seconds
        maximumAge: 60000 // Use cached position if less than 1 minute old
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: LocationCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          };

          this.currentPosition = coords;
          console.log('✅ Position obtained:', coords);

          resolve({
            success: true,
            coordinates: coords
          });
        },
        (error) => {
          console.log('❌ Position failed:', error);
          
          resolve({
            success: false,
            error: this.getLocationErrorMessage(error),
            needsPermission: error.code === 1
          });
        },
        options
      );
    });
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(coord1: LocationCoordinates, coord2: LocationCoordinates): number {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = this.toRadians(coord1.latitude);
    const lat2Rad = this.toRadians(coord2.latitude);
    const deltaLatRad = this.toRadians(coord2.latitude - coord1.latitude);
    const deltaLonRad = this.toRadians(coord2.longitude - coord1.longitude);

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return Math.round(R * c);
  }

  /**
   * Check if user is within allowed radius of workplace
   */
  async checkWorkLocation(
    workLatitude: number,
    workLongitude: number,
    allowedRadius: number
  ): Promise<LocationCheckResult | null> {
    const locationResult = await this.getCurrentPosition();
    
    if (!locationResult.success || !locationResult.coordinates) {
      throw new Error(locationResult.error || 'Failed to get location');
    }

    const distance = this.calculateDistance(
      locationResult.coordinates,
      { latitude: workLatitude, longitude: workLongitude }
    );

    return {
      isWithinRadius: distance <= allowedRadius,
      distance,
      userCoords: locationResult.coordinates,
      accuracy: locationResult.coordinates.accuracy
    };
  }

  /**
   * Format distance for display
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${meters}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }

  /**
   * Format accuracy for display
   */
  formatAccuracy(accuracy?: number): string {
    if (!accuracy) return 'Unknown accuracy';
    if (accuracy <= 5) return `Very high accuracy (±${Math.round(accuracy)}m)`;
    if (accuracy <= 20) return `High accuracy (±${Math.round(accuracy)}m)`;
    if (accuracy <= 100) return `Medium accuracy (±${Math.round(accuracy)}m)`;
    return `Low accuracy (±${Math.round(accuracy)}m)`;
  }

  /**
   * Get status message for location check
   */
  getLocationStatusMessage(isWithinRadius: boolean, distance: number, allowedRadius: number): string {
    if (isWithinRadius) {
      return `OK: You are at your workplace (${this.formatDistance(distance)} from center)`;
    } else {
      const excess = distance - allowedRadius;
      return `Error: You are ${this.formatDistance(excess)} beyond the allowed work area`;
    }
  }

  /**
   * Get browser-specific permission instructions
   */
  getBrowserInstructions(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('chrome')) {
      return 'Chrome: Look for a location popup dialog, or click the location icon in the address bar → Allow';
    } else if (userAgent.includes('safari')) {
      return 'Safari: Look for a location popup dialog, or go to Settings → Privacy & Security → Location Services → Safari Websites → Allow';
    } else if (userAgent.includes('firefox')) {
      return 'Firefox: Look for a location popup dialog, or click the shield icon → Location → Allow';
    } else if (userAgent.includes('edge')) {
      return 'Edge: Look for a location popup dialog, or click the location icon in the address bar → Allow';
    } else {
      return 'Look for a location permission popup dialog, or find the location icon in your browser and select Allow';
    }
  }

  // Private helper methods
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private getPermissionMessage(state: PermissionState): string {
    switch (state) {
      case 'granted':
        return 'Location permission granted';
      case 'denied':
        return 'Location permission denied - please enable in browser settings';
      case 'prompt':
        return 'Ready to request location permission';
      default:
        return 'Unknown permission state';
    }
  }

  private getLocationErrorMessage(error: GeolocationPositionError): string {
    switch (error.code) {
      case 1:
        return 'Location access denied. Please enable location permissions.';
      case 2:
        return 'Location unavailable. Please enable location services.';
      case 3:
        return 'Location request timed out. Please try again.';
      default:
        return `Location error: ${error.message}`;
    }
  }
}

// Export singleton instance
export const improvedLocationService = ImprovedLocationService.getInstance();

// Export default
export default improvedLocationService;