import React, { useState, useEffect, useRef } from 'react';
import { timeTrackingService, BranchLocation } from '../lib/supabase';
import { locationService, LocationUtils, Coordinates } from '../lib/location-service';
import GoogleMapsPicker from './GoogleMapsPicker';

interface BranchLocationPickerProps {
  branch: any;
  location?: BranchLocation | null;
  onSave: (branchId: string) => void;
  onClose: () => void;
}

const BranchLocationPicker: React.FC<BranchLocationPickerProps> = ({
  branch,
  location,
  onSave,
  onClose
}) => {
  const [formData, setFormData] = useState({
    latitude: 0,
    longitude: 0,
    address: '',
    radius_meters: 50
  });
  const [saving, setSaving] = useState(false);
  const [hasValidLocation, setHasValidLocation] = useState(false);

  useEffect(() => {
    if (location) {
      setFormData({
        latitude: Number(location.latitude) || 0,
        longitude: Number(location.longitude) || 0,
        address: location.address || '',
        radius_meters: Number(location.radius_meters) || 50
      });
      setHasValidLocation(!!location.latitude && !!location.longitude);
    } else {
      // Default to London coordinates if no location set
      setFormData({
        latitude: 51.505,
        longitude: -0.09,
        address: '',
        radius_meters: 50
      });
      setHasValidLocation(false);
    }
  }, [location]);

  const handleLocationSelect = (lat: number, lng: number, address?: string) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      address: address || prev.address
    }));
    setHasValidLocation(true);
  };

  const handleRadiusChange = (radius: number) => {
    setFormData(prev => ({
      ...prev,
      radius_meters: radius
    }));
  };

  const handleSave = async () => {
    if (!hasValidLocation || !formData.latitude || !formData.longitude) {
      alert('Please select a location on the map');
      return;
    }

    setSaving(true);
    try {
      const locationData = {
        branch_id: branch.id,
        latitude: formData.latitude,
        longitude: formData.longitude,
        address: formData.address.trim() || undefined,
        radius_meters: formData.radius_meters || 50
      };

      if (location?.id) {
        await timeTrackingService.updateBranchLocation(location.id, locationData);
      } else {
        await timeTrackingService.createBranchLocation(locationData);
      }
      
      alert('Location saved successfully!');
      onSave(branch.id);
      onClose();
    } catch (error: any) {
      alert('Error saving location: ' + error.message);
    } finally {
      setSaving(false);
    }
  };



  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-6 border w-full max-w-6xl shadow-lg rounded-lg bg-white">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Set Location for {branch.name || branch.branch_name || 'Branch'}
          </h3>
          <p className="text-sm text-gray-600">
            Use the interactive map below to set the exact location and radius for employee clock-in verification.
          </p>
        </div>

        {/* Current Location Info */}
        {hasValidLocation && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-green-800">Location Selected</h4>
                <div className="text-sm text-green-700 mt-1">
                  <p><strong>Coordinates:</strong> {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}</p>
                  {formData.address && <p><strong>Address:</strong> {formData.address}</p>}
                  <p><strong>Allowed Radius:</strong> {formData.radius_meters} meters</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Google Maps Component */}
        <div className="mb-6">
          <GoogleMapsPicker
            initialLat={formData.latitude}
            initialLng={formData.longitude}
            initialRadius={formData.radius_meters}
            onLocationSelect={handleLocationSelect}
            onRadiusChange={handleRadiusChange}
            showRadius={true}
            height="500px"
            className="w-full"
          />
        </div>

        {/* Additional Options */}
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Additional Settings</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address (Optional)
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter or edit the address for this location"
              />
              <p className="text-xs text-gray-500 mt-1">
                This address will be shown to employees for reference
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end space-x-3 mt-8 pt-6 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formData.latitude || !formData.longitude}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
          >
            {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
            <span>{saving ? 'Saving...' : 'Save Location'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BranchLocationPicker; 