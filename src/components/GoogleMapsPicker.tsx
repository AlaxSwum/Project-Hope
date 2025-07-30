import React, { useState, useEffect, useRef } from 'react';

interface GoogleMapsPickerProps {
  initialLat?: number;
  initialLng?: number;
  initialRadius?: number;
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
  onRadiusChange?: (radius: number) => void;
  showRadius?: boolean;
  height?: string;
  className?: string;
}

interface GoogleMapsAPI {
  maps: {
    Map: any;
    Marker: any;
    Circle: any;
    Geocoder: any;
    InfoWindow: any;
    event: any;
    LatLng: any;
    MapTypeId: any;
  };
}

declare global {
  interface Window {
    google: GoogleMapsAPI;
    initGoogleMaps: () => void;
  }
}

const GoogleMapsPicker: React.FC<GoogleMapsPickerProps> = ({
  initialLat = 51.505,
  initialLng = -0.09,
  initialRadius = 50,
  onLocationSelect,
  onRadiusChange,
  showRadius = true,
  height = '400px',
  className = ''
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [circle, setCircle] = useState<any>(null);
  const [geocoder, setGeocoder] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRadius, setCurrentRadius] = useState(initialRadius);

  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setIsLoaded(true);
        setIsLoading(false);
        return;
      }

      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        // Script already loading
        const checkGoogle = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(checkGoogle);
            setIsLoaded(true);
            setIsLoading(false);
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        setIsLoaded(true);
        setIsLoading(false);
      };
      
      script.onerror = () => {
        setError('Failed to load Google Maps API');
        setIsLoading(false);
      };

      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // Initialize map when Google Maps is loaded
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    try {
      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center: { lat: initialLat, lng: initialLng },
        zoom: 15,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      const geocoderInstance = new window.google.maps.Geocoder();
      
      setMap(mapInstance);
      setGeocoder(geocoderInstance);

      // Add initial marker
      const initialMarker = new window.google.maps.Marker({
        position: { lat: initialLat, lng: initialLng },
        map: mapInstance,
        draggable: true,
        title: 'Branch Location'
      });

      setMarker(initialMarker);

      // Add initial circle if showRadius is true
      if (showRadius) {
        const initialCircle = new window.google.maps.Circle({
          map: mapInstance,
          center: { lat: initialLat, lng: initialLng },
          radius: currentRadius,
          fillColor: '#4F46E5',
          fillOpacity: 0.1,
          strokeColor: '#4F46E5',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          editable: true
        });

        setCircle(initialCircle);

        // Handle radius changes
        window.google.maps.event.addListener(initialCircle, 'radius_changed', () => {
          const newRadius = Math.round(initialCircle.getRadius());
          setCurrentRadius(newRadius);
          onRadiusChange?.(newRadius);
        });
      }

      // Handle map clicks
      window.google.maps.event.addListener(mapInstance, 'click', (event: any) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        
        // Update marker position
        initialMarker.setPosition(event.latLng);
        
        // Update circle position if exists
        if (initialCircle) {
          initialCircle.setCenter(event.latLng);
        }

        // Get address from coordinates
        geocoderInstance.geocode(
          { location: event.latLng },
          (results: any[], status: string) => {
            const address = status === 'OK' && results[0] 
              ? results[0].formatted_address 
              : undefined;
            
            onLocationSelect(lat, lng, address);
          }
        );
      });

      // Handle marker drag
      window.google.maps.event.addListener(initialMarker, 'dragend', (event: any) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        
        // Update circle position if exists
        if (initialCircle) {
          initialCircle.setCenter(event.latLng);
        }

        // Get address from coordinates
        geocoderInstance.geocode(
          { location: event.latLng },
          (results: any[], status: string) => {
            const address = status === 'OK' && results[0] 
              ? results[0].formatted_address 
              : undefined;
            
            onLocationSelect(lat, lng, address);
          }
        );
      });

    } catch (err) {
      setError('Failed to initialize Google Maps');
      console.error('Google Maps initialization error:', err);
    }
  }, [isLoaded, initialLat, initialLng, showRadius]);

  // Method to search for an address
  const searchAddress = (address: string) => {
    if (!geocoder) return;

    geocoder.geocode({ address }, (results: any[], status: string) => {
      if (status === 'OK' && results[0]) {
        const location = results[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();

        // Update map center
        map.setCenter(location);
        map.setZoom(15);

        // Update marker
        marker.setPosition(location);

        // Update circle if exists
        if (circle) {
          circle.setCenter(location);
        }

        onLocationSelect(lat, lng, results[0].formatted_address);
      } else {
        alert('Address not found. Please try a different search term.');
      }
    });
  };

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const location = new window.google.maps.LatLng(lat, lng);

        // Update map
        map.setCenter(location);
        map.setZoom(15);

        // Update marker
        marker.setPosition(location);

        // Update circle if exists
        if (circle) {
          circle.setCenter(location);
        }

        // Get address
        geocoder.geocode({ location }, (results: any[], status: string) => {
          const address = status === 'OK' && results[0] 
            ? results[0].formatted_address 
            : undefined;
          
          onLocationSelect(lat, lng, address);
        });
      },
      (error) => {
        alert('Error getting current location: ' + error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  if (error) {
    return (
      <div className={`${className} border-2 border-dashed border-gray-300 rounded-lg p-8`} style={{ height }}>
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">⚠️ Map Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Please check your Google Maps API key configuration.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${className} border-2 border-dashed border-gray-300 rounded-lg p-8`} style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Google Maps...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Map Controls */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={getCurrentLocation}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Use Current Location</span>
          </button>
          
          {showRadius && (
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-600">Radius:</span>
              <span className="font-medium text-blue-600">{currentRadius}m</span>
            </div>
          )}
        </div>

        {/* Address Search */}
        <AddressSearch onSearch={searchAddress} />
      </div>

      {/* Map Container */}
      <div 
        ref={mapRef} 
        className="w-full border border-gray-300 rounded-lg"
        style={{ height }}
      />

      {/* Instructions */}
      <div className="mt-3 text-sm text-gray-600">
        <p>• Click anywhere on the map to set the location</p>
        <p>• Drag the marker to fine-tune the position</p>
        {showRadius && <p>• Drag the circle edge to adjust the allowed radius</p>}
      </div>
    </div>
  );
};

// Address Search Component
interface AddressSearchProps {
  onSearch: (address: string) => void;
}

const AddressSearch: React.FC<AddressSearchProps> = ({ onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm.trim());
    }
  };

  return (
    <form onSubmit={handleSearch} className="flex space-x-2">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search for an address..."
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
      >
        Search
      </button>
    </form>
  );
};

export default GoogleMapsPicker; 