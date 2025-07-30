// Location service for handling geolocation and distance calculations

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface LocationError {
  code: number;
  message: string;
  type: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED';
}

class LocationService {
  private watchId: number | null = null;
  private lastKnownPosition: Coordinates | null = null;

  /**
   * Get current position with high accuracy
   */
  getCurrentPosition(options?: PositionOptions): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject({
          code: 0,
          message: 'Geolocation is not supported by this browser',
          type: 'NOT_SUPPORTED'
        } as LocationError);
        return;
      }

      const defaultOptions: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds
        maximumAge: 30000 // 30 seconds
      };

      const finalOptions = { ...defaultOptions, ...options };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          
          this.lastKnownPosition = coords;
          resolve(coords);
        },
        (error) => {
          const locationError: LocationError = {
            code: error.code,
            message: this.getErrorMessage(error.code),
            type: this.getErrorType(error.code)
          };
          reject(locationError);
        },
        finalOptions
      );
    });
  }

  /**
   * Watch position changes (useful for continuous monitoring)
   */
  watchPosition(
    onSuccess: (coords: Coordinates) => void,
    onError?: (error: LocationError) => void,
    options?: PositionOptions
  ): number | null {
    if (!navigator.geolocation) {
      if (onError) {
        onError({
          code: 0,
          message: 'Geolocation is not supported by this browser',
          type: 'NOT_SUPPORTED'
        });
      }
      return null;
    }

    const defaultOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 10000
    };

    const finalOptions = { ...defaultOptions, ...options };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        
        this.lastKnownPosition = coords;
        onSuccess(coords);
      },
      (error) => {
        if (onError) {
          const locationError: LocationError = {
            code: error.code,
            message: this.getErrorMessage(error.code),
            type: this.getErrorType(error.code)
          };
          onError(locationError);
        }
      },
      finalOptions
    );

    return this.watchId;
  }

  /**
   * Stop watching position
   */
  clearWatch(): void {
    if (this.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Get last known position
   */
  getLastKnownPosition(): Coordinates | null {
    return this.lastKnownPosition;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in meters
   */
  calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
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
   * Check if user is within allowed radius of a target location
   */
  isWithinRadius(
    userCoords: Coordinates, 
    targetCoords: Coordinates, 
    radiusMeters: number
  ): boolean {
    const distance = this.calculateDistance(userCoords, targetCoords);
    return distance <= radiusMeters;
  }

  /**
   * Get user's location and verify if they're within work location
   */
  async verifyWorkLocation(
    targetCoords: Coordinates, 
    radiusMeters: number = 50
  ): Promise<{
    isWithinRadius: boolean;
    distance: number;
    userCoords: Coordinates;
    accuracy?: number;
  }> {
    try {
      const userCoords = await this.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000 // Use cached position if less than 5 seconds old
      });

      const distance = this.calculateDistance(userCoords, targetCoords);
      const isWithinRadius = distance <= radiusMeters;

      return {
        isWithinRadius,
        distance,
        userCoords,
        accuracy: userCoords.accuracy
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Request location permission
   */
  async requestPermission(): Promise<PermissionState> {
    if (!navigator.permissions) {
      // Fallback: try to get position to trigger permission prompt
      try {
        await this.getCurrentPosition({ timeout: 1000 });
        return 'granted';
      } catch {
        return 'denied';
      }
    }

    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return permission.state;
  }

  /**
   * Check if geolocation is supported
   */
  isSupported(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Format coordinates for display
   */
  formatCoordinates(coords: Coordinates, precision: number = 6): string {
    return `${coords.latitude.toFixed(precision)}, ${coords.longitude.toFixed(precision)}`;
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

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private getErrorMessage(code: number): string {
    switch (code) {
      case 1:
        return 'Location access denied by user';
      case 2:
        return 'Location information is unavailable';
      case 3:
        return 'Location request timed out';
      default:
        return 'An unknown error occurred while retrieving location';
    }
  }

  private getErrorType(code: number): LocationError['type'] {
    switch (code) {
      case 1:
        return 'PERMISSION_DENIED';
      case 2:
        return 'POSITION_UNAVAILABLE';
      case 3:
        return 'TIMEOUT';
      default:
        return 'NOT_SUPPORTED';
    }
  }
}

// Create singleton instance
export const locationService = new LocationService();

// Utility functions for common use cases
export const LocationUtils = {
  /**
   * Quick check if user is at work location
   */
  async checkWorkLocation(
    workLatitude: number,
    workLongitude: number,
    allowedRadius: number = 50
  ) {
    const targetCoords = { latitude: workLatitude, longitude: workLongitude };
    return locationService.verifyWorkLocation(targetCoords, allowedRadius);
  },

  /**
   * Get readable location status message
   */
  getLocationStatusMessage(
    isWithinRadius: boolean,
    distance: number,
    allowedRadius: number
  ): string {
    if (isWithinRadius) {
      return `✅ You are at your workplace (${locationService.formatDistance(distance)} away)`;
    } else {
      const excess = distance - allowedRadius;
      return `❌ You are too far from your workplace (${locationService.formatDistance(excess)} beyond allowed radius)`;
    }
  },

  /**
   * Format accuracy for display
   */
  formatAccuracy(accuracy?: number): string {
    if (!accuracy) return 'Unknown accuracy';
    if (accuracy <= 5) return 'Very high accuracy';
    if (accuracy <= 20) return 'High accuracy';
    if (accuracy <= 100) return 'Medium accuracy';
    return 'Low accuracy';
  }
};

export default locationService; 